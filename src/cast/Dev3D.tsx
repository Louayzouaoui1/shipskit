import { Quaternion, Vector3 } from "three";
import { joint, type Pose } from "./Rig";

// The developer: hoodie, jeans, red sneakers, glasses and a headset
// with a mic. Same pose rig as Rig.tsx, modelled in its drawing units (300 tall).
export const FIGURE_SCALE = 1.9 / 300;
const UP = new Vector3(0, 1, 0);
const rad = (degrees: number) => (degrees * Math.PI) / 180;

type P3 = [number, number, number];

const SKIN = "#f0c1a1";
const HAIR = "#2f211c";
const HOODIE = "#3d4f8f";
const HOODIE_DARK = "#324278";
const JEANS = "#2b3350";
const GEAR = "#1d1c24";

/** A rounded limb segment between two points. */
export const Limb = ({
  a,
  b,
  r,
  color,
  rough = 0.8,
}: {
  readonly a: P3;
  readonly b: P3;
  readonly r: number;
  readonly color: string;
  readonly rough?: number;
}) => {
  const from = new Vector3(...a);
  const along = new Vector3(...b).sub(from);
  return (
    <mesh
      position={from.clone().addScaledVector(along, 0.5)}
      quaternion={new Quaternion().setFromUnitVectors(
        UP,
        along.clone().normalize(),
      )}
      castShadow
    >
      <capsuleGeometry args={[r, along.length(), 8, 16]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
};

// Hands must never pass through the head or the chest: a hand that would end up inside is
// pushed forward until it rests on the surface (a facepalm lands on the face, not in it).
const HEAD_Y = 142;
const HEAD_R = 50;
export const keepOut = (hand: P3): P3 => {
  const [x, y] = hand;
  let z = hand[2];
  const reach = HEAD_R + 14;
  const flat = Math.hypot(x, y - HEAD_Y);
  if (flat < reach) z = Math.max(z, Math.sqrt(reach * reach - flat * flat));
  if (Math.abs(x) < 46 && y < 96) z = Math.max(z, 44);
  return [x, y, z];
};

export const Dev3D = ({
  pose,
  talk,
  frame,
  x,
  z,
  yaw,
}: {
  readonly pose: Pose;
  /** 0 to 1: how open the mouth is right now, from the voice recording. */
  readonly talk: number;
  readonly frame: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}) => {
  const tremble = pose.shake * Math.sin(frame * 1.7);
  const breath = Math.sin(frame / 14) * 1.5;
  const lift =
    pose.hop +
    pose.shake * Math.abs(Math.sin(frame / 2.4)) * 8 +
    Math.abs(Math.sin(rad(pose.spin))) * 40;
  const hip = 104 - pose.crouch;
  const blink = (frame + 37) % 97 < 4 ? 0.1 : 1;
  const open = Math.max(talk, pose.gasp);
  const lid = Math.max(0.12, Math.min(1.3, pose.eye)) * blink;

  const arms = [-1, 1].map((side) => {
    const outward = side < 0 ? pose.hLx : pose.hRx;
    const up = side < 0 ? pose.hLy : pose.hRy;
    const drum = pose.typing * Math.sin(frame * 1.9 + (side < 0 ? 0 : 2)) * 9;
    const shoulder: [number, number] = [side * 38, 74 + breath * 0.4];
    const [elbow, wrist] = joint(
      shoulder,
      [side * (outward + tremble * 5), -up - drum - tremble * 4],
      46,
      44,
      side,
    );
    const hand = keepOut([...wrist, 24 + pose.typing * 26]);
    return {
      side,
      shoulder: [...shoulder, 0] as P3,
      elbow: [...elbow, 4 + hand[2] * 0.3] as P3,
      hand,
    };
  });
  const legs = [-1, 1].map((side) => {
    const top: [number, number] = [side * 13, hip];
    const [knee, foot] = joint(top, [side * 24, 12], 54, 54, side);
    return {
      side,
      top: [...top, 0] as P3,
      knee: [knee[0], Math.max(12, knee[1]), 10 + pose.crouch * 0.7] as P3,
      foot: [...foot, 0] as P3,
    };
  });

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]} scale={FIGURE_SCALE}>
      <group rotation={[0, 0, -rad(pose.spin)]}>
        <group position={[tremble * 3, lift, 0]}>
          {legs.map((leg) => (
            <group key={leg.side}>
              <Limb a={leg.top} b={leg.knee} r={12.5} color={JEANS} />
              <Limb a={leg.knee} b={leg.foot} r={11} color={JEANS} />
              <mesh
                position={[leg.foot[0], 12, 10]}
                scale={[13, 11, 22]}
                castShadow
              >
                <sphereGeometry args={[1, 20, 14]} />
                <meshStandardMaterial color="#e2503f" roughness={0.6} />
              </mesh>
              <mesh position={[leg.foot[0], 3, 12]} castShadow>
                <boxGeometry args={[25, 6, 46]} />
                <meshStandardMaterial color="#f6f4ef" roughness={0.5} />
              </mesh>
            </group>
          ))}

          <group position={[0, hip, 0]} rotation={[0, 0, -rad(pose.lean)]}>
            <mesh
              position={[0, 42, 0]}
              scale={[1, 1 + breath * 0.004, 0.8]}
              castShadow
            >
              <capsuleGeometry args={[37, 44, 12, 28]} />
              <meshStandardMaterial color={HOODIE} roughness={0.9} />
            </mesh>
            <mesh position={[0, 16, 27]} scale={[1, 1, 0.35]} castShadow>
              <capsuleGeometry args={[13, 26, 8, 16]} />
              <meshStandardMaterial color={HOODIE_DARK} roughness={0.9} />
            </mesh>
            <mesh position={[0, 92, -16]} scale={[1.05, 0.8, 0.9]} castShadow>
              <sphereGeometry args={[32, 24, 16]} />
              <meshStandardMaterial color={HOODIE_DARK} roughness={0.9} />
            </mesh>
            {[-8, 8].map((sx) => (
              <mesh key={sx} position={[sx, 62, 31]}>
                <cylinderGeometry args={[1.6, 1.6, 28, 6]} />
                <meshStandardMaterial color="#f4f4f6" />
              </mesh>
            ))}
            <mesh position={[0, 94, 0]}>
              <cylinderGeometry args={[14, 16, 16, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.6} />
            </mesh>

            {arms.map((arm) => (
              <group key={arm.side}>
                <Limb
                  a={arm.shoulder}
                  b={arm.elbow}
                  r={11.5}
                  color={HOODIE}
                  rough={0.9}
                />
                <Limb
                  a={arm.elbow}
                  b={arm.hand}
                  r={10}
                  color={HOODIE}
                  rough={0.9}
                />
                <mesh position={arm.hand} castShadow>
                  <sphereGeometry args={[12.5, 20, 14]} />
                  <meshStandardMaterial color={SKIN} roughness={0.6} />
                </mesh>
                <mesh
                  position={[
                    arm.hand[0] - arm.side * 9,
                    arm.hand[1] + 6,
                    arm.hand[2] + 6,
                  ]}
                >
                  <sphereGeometry args={[5.5, 12, 10]} />
                  <meshStandardMaterial color={SKIN} roughness={0.6} />
                </mesh>
              </group>
            ))}

            <group
              position={[0, HEAD_Y + talk * 2, 0]}
              rotation={[
                pose.lookY * 0.3,
                pose.lookX * 0.55,
                -rad(pose.tilt + talk * Math.sin(frame / 2.5) * 2),
              ]}
            >
              <mesh castShadow>
                <sphereGeometry args={[HEAD_R, 48, 32]} />
                <meshStandardMaterial color={SKIN} roughness={0.55} />
              </mesh>
              {/* Hair: a cap over the top and back, and a fringe */}
              <mesh rotation={[-0.55, 0, 0]} castShadow>
                <sphereGeometry
                  args={[53, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]}
                />
                <meshStandardMaterial color={HAIR} roughness={0.95} />
              </mesh>
              {[
                [-20, 44, 28, 0.3],
                [2, 48, 28, 0],
                [22, 44, 27, -0.3],
              ].map(([hx, hy, hz, turn]) => (
                <mesh
                  key={hx}
                  position={[hx, hy, hz]}
                  rotation={[0.5, 0, turn]}
                  scale={[17, 9, 14]}
                >
                  <sphereGeometry args={[1, 16, 12]} />
                  <meshStandardMaterial color={HAIR} roughness={0.95} />
                </mesh>
              ))}

              {[-1, 1].map((side) => (
                <group key={side}>
                  <group position={[side * 19, 6, 40]} scale={[1, lid, 1]}>
                    <mesh scale={[1, 1.1, 0.55]}>
                      <sphereGeometry args={[12, 24, 16]} />
                      <meshStandardMaterial color="#fdfdfb" roughness={0.2} />
                    </mesh>
                    <mesh
                      position={[pose.lookX * 3.5, -pose.lookY * 2.5, 6.2]}
                      scale={[1, 1, 0.45]}
                    >
                      <sphereGeometry args={[6.8, 20, 14]} />
                      <meshStandardMaterial color="#3b2a20" roughness={0.2} />
                    </mesh>
                    <mesh
                      position={[
                        pose.lookX * 3.5 + 2.2,
                        -pose.lookY * 2.5 + 2.6,
                        9.4,
                      ]}
                    >
                      <sphereGeometry args={[1.9, 8, 8]} />
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </group>
                  <mesh
                    position={[side * 19, 25 + pose.brow * 6, 47]}
                    rotation={[
                      0,
                      side * 0.3,
                      Math.PI / 2 + side * -Math.min(0, pose.brow) * 0.5,
                    ]}
                  >
                    <capsuleGeometry args={[2.8, 15, 6, 10]} />
                    <meshStandardMaterial color={HAIR} roughness={0.9} />
                  </mesh>
                  {/* Glasses */}
                  <mesh position={[side * 19, 6, 53]}>
                    <torusGeometry args={[14, 1.5, 8, 30]} />
                    <meshStandardMaterial
                      color={GEAR}
                      roughness={0.3}
                      metalness={0.4}
                    />
                  </mesh>
                  <Limb
                    a={[side * 33, 7, 52]}
                    b={[side * 53, 7, 18]}
                    r={1.3}
                    color={GEAR}
                    rough={0.3}
                  />
                  {/* Headset: ear cup with a cushion */}
                  <mesh
                    position={[side * 55, 2, 0]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                  >
                    <cylinderGeometry args={[19, 19, 13, 28]} />
                    <meshStandardMaterial color={GEAR} roughness={0.5} />
                  </mesh>
                  <mesh
                    position={[side * 49.5, 2, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                  >
                    <torusGeometry args={[14, 5, 10, 24]} />
                    <meshStandardMaterial color="#3a3846" roughness={0.9} />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 6, 53]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[1.4, 1.4, 11, 6]} />
                <meshStandardMaterial
                  color={GEAR}
                  roughness={0.3}
                  metalness={0.4}
                />
              </mesh>
              <mesh position={[0, 2, 0]} castShadow>
                <torusGeometry args={[56, 4.6, 10, 36, Math.PI]} />
                <meshStandardMaterial color={GEAR} roughness={0.5} />
              </mesh>
              <Limb
                a={[-56, -8, 10]}
                b={[-30, -27, 43]}
                r={2.2}
                color={GEAR}
                rough={0.5}
              />
              <mesh position={[-28, -27, 45]}>
                <sphereGeometry args={[5.5, 12, 10]} />
                <meshStandardMaterial color="#3a3846" roughness={0.9} />
              </mesh>

              <mesh position={[0, -6, 49]} scale={[6, 5.5, 6]}>
                <sphereGeometry args={[1, 14, 10]} />
                <meshStandardMaterial color="#e3ad8c" roughness={0.6} />
              </mesh>
              {open > 0.06 ? (
                <mesh
                  position={[0, -26, 43.5]}
                  scale={[12 - open * 2, 2.5 + open * 13, 5]}
                >
                  <sphereGeometry args={[1, 18, 12]} />
                  <meshStandardMaterial color="#5a1f2a" roughness={0.4} />
                </mesh>
              ) : (
                <mesh
                  position={[0, pose.smile >= 0 ? -21 : -31, 44.5]}
                  rotation={[0, 0, pose.smile >= 0 ? Math.PI : 0]}
                  scale={[1, Math.max(0.12, Math.abs(pose.smile)), 1]}
                >
                  <torusGeometry args={[11, 2.4, 8, 20, Math.PI]} />
                  <meshStandardMaterial color="#7a3b33" />
                </mesh>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
