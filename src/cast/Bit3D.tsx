import { useMemo } from "react";
import { Color } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Limb } from "./Dev3D";
import { joint, type Pose } from "./Rig";

// Bit, the robot: a mint shell with a dark visor, two glowing round eyes, an antenna and two
// feet. It has no mouth, so it talks with its whole body: it bounces with the voice and the
// antenna lights up. `pose.power` switches it off (eyes dark, colour drained).
export const BIT_SCALE = 0.0042;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

type P3 = [number, number, number];

const OFF = new Color("#5d6f6b");
const mix = (on: string, power: number) =>
  `#${new Color(on).lerp(OFF, 1 - power).getHexString()}`;
const HALF_WIDE = 66;
const SHOULDER = HALF_WIDE + 2;

export const Bit3D = ({
  pose,
  talk,
  frame,
  x,
  y,
  z,
  yaw,
}: {
  readonly pose: Pose;
  readonly talk: number;
  readonly frame: number;
  readonly x: number;
  /** Height of the surface it stands on. */
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}) => {
  const shapes = useMemo(
    () => ({
      body: new RoundedBoxGeometry(HALF_WIDE * 2, 120, 104, 8, 30),
      visor: new RoundedBoxGeometry(104, 58, 10, 4, 22),
      foot: new RoundedBoxGeometry(46, 22, 66, 4, 9),
    }),
    [],
  );

  const power = Math.max(0, Math.min(1, pose.power));
  const shell = mix("#35c9a5", power);
  const dark = mix("#1f8f78", power);
  const glow = mix("#7df9ff", power);
  const tremble = pose.shake * Math.sin(frame * 1.7 + 2);
  const lift =
    pose.hop +
    pose.shake * Math.abs(Math.sin(frame / 2.4)) * 6 +
    Math.abs(Math.sin(rad(pose.spin))) * 52;
  const bodyY = 22 + 60 - pose.crouch * 0.5 + talk * 5 * power;
  const blink = (frame + 61) % 113 < 4 ? 0.1 : 1;
  const lid = Math.max(
    0.07,
    (Math.min(1.3, pose.eye) + pose.gasp * 0.25 + Math.min(0, pose.brow) * 0.3) *
      blink *
      (0.12 + 0.88 * power),
  );

  // The human rig's hand targets, shrunk onto the robot's short arms.
  const arms = [-1, 1].map((side) => {
    const outward = side < 0 ? pose.hLx : pose.hRx;
    const up = side < 0 ? pose.hLy : pose.hRy;
    const drum = pose.typing * Math.sin(frame * 1.9 + (side < 0 ? 0 : 2)) * 8;
    const shoulder: [number, number] = [side * SHOULDER, 8];
    const [elbow, wrist] = joint(
      shoulder,
      [
        side * Math.max(50, SHOULDER + (outward - 38) * 0.62 + tremble * 4),
        8 + (-up - 74) * 0.62 - drum,
      ],
      30,
      28,
      side,
    );
    // A hand that comes in front of the body stays in front of it, not inside.
    const forward =
      Math.abs(wrist[0]) < HALF_WIDE + 16 ? 68 : 22 + pose.typing * 22;
    return {
      side,
      shoulder: [...shoulder, 0] as P3,
      elbow: [...elbow, forward * 0.4] as P3,
      hand: [...wrist, forward] as P3,
    };
  });

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={BIT_SCALE}>
      <group rotation={[-rad(pose.spin), 0, 0]}>
        <group position={[tremble * 3, lift, 0]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={shapes.foot}
              position={[
                side * 34,
                11 +
                  Math.max(0, Math.sin(frame * 0.9 + side * 1.6)) *
                    8 *
                    pose.typing *
                    power,
                4,
              ]}
              castShadow
            >
              <meshStandardMaterial color={dark} roughness={0.5} />
            </mesh>
          ))}

          <group
            position={[0, bodyY, 0]}
            rotation={[
              pose.lookY * 0.22,
              pose.lookX * 0.5,
              -rad(pose.lean + pose.tilt),
            ]}
            scale={[1 - talk * 0.03 * power, 1 + talk * 0.07 * power, 1]}
          >
            <mesh geometry={shapes.body} castShadow>
              <meshPhysicalMaterial
                color={shell}
                roughness={0.35}
                clearcoat={0.5}
                clearcoatRoughness={0.25}
              />
            </mesh>
            <mesh geometry={shapes.visor} position={[0, 12, 50]}>
              <meshStandardMaterial color="#0e1c26" roughness={0.2} />
            </mesh>
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * 24 + pose.lookX * 7, 12 - pose.lookY * 5, 56]}
                scale={[1 + talk * 0.06 * power, lid, 1]}
              >
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[12, 12, 3, 24]} />
                  <meshStandardMaterial
                    color={glow}
                    emissive={glow}
                    emissiveIntensity={1.1 * power}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            ))}
            {/* Antenna: the ball lights up with the voice. */}
            <group
              position={[0, 60, 0]}
              rotation={[0, 0, Math.sin(frame * 0.21) * 0.05 * power]}
            >
              <mesh position={[0, 12, 0]}>
                <cylinderGeometry args={[3, 3, 26, 10]} />
                <meshStandardMaterial color={dark} roughness={0.5} />
              </mesh>
              <mesh position={[0, 30, 0]} castShadow>
                <sphereGeometry args={[9, 20, 14]} />
                <meshStandardMaterial
                  color={mix("#ff7a59", power)}
                  emissive="#ff7a59"
                  emissiveIntensity={(0.25 + talk * 1.6) * power}
                  roughness={0.35}
                />
              </mesh>
            </group>
            {arms.map((a) => (
              <group key={a.side}>
                <Limb
                  a={a.shoulder}
                  b={a.elbow}
                  r={10}
                  color={dark}
                  rough={0.5}
                />
                <Limb a={a.elbow} b={a.hand} r={9} color={dark} rough={0.5} />
                <mesh position={a.hand} castShadow>
                  <sphereGeometry args={[15, 20, 14]} />
                  <meshStandardMaterial color={shell} roughness={0.45} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
};
