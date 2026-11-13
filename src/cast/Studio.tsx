import { useMemo } from "react";
import { DirectionalLight, type Matrix4 } from "three";

// The set: a developer's room at night, lit like a film set (warm key light with
// soft shadows, cool rim light from behind, glow from the screen and the lamp). A small
// table in front holds the robot at eye level. `view` moves the room in front of a camera
// that stays at the origin.

export const WALL_SCREEN = { x: 0, y: 3.3, z: -3.05, w: 1.9, h: 1.1 };
export const TABLE = { x: 0.8, top: 1.1, z: 0.05 };
const CODE = ["#7dd3fc", "#86efac", "#f9a8d4", "#fde68a", "#c4b5fd"];
const PLANKS = ["#b98a5e", "#ad7f54", "#c2946a", "#b4865a"];

export type ScreenState = "code" | "diff" | "crash" | "warn" | "pass";
const SCREENS: Record<ScreenState, { glass: string; glow: string }> = {
  code: { glass: "#101a35", glow: "#6fa8ff" },
  diff: { glass: "#0d1424", glow: "#6fa8ff" },
  crash: { glass: "#4a0f1a", glow: "#ff4d5e" },
  warn: { glass: "#2a1a10", glow: "#ffb347" },
  pass: { glass: "#0c2a1b", glow: "#4ade80" },
};

export const Studio = ({
  view,
  frame,
  screen,
  bars,
  children,
}: {
  readonly view: Matrix4;
  readonly frame: number;
  readonly screen: ScreenState;
  /** Scrolling lines of pretend code, for a screen with no words on it. */
  readonly bars: boolean;
  /** The characters, placed in the room's own coordinates. */
  readonly children: React.ReactNode;
}) => {
  // Lights that aim at a point need that point inside the room too, or they would aim at the camera.
  const { key, rim } = useMemo(() => {
    const keyLight = new DirectionalLight("#fff0dc", 2.1);
    keyLight.position.set(-3.2, 6, 6);
    keyLight.target.position.set(0.1, 1.2, 0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -4.5;
    keyLight.shadow.camera.right = 4.5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 5;
    const rimLight = new DirectionalLight("#8fb0ff", 2.8);
    rimLight.position.set(2.6, 4.6, -2.8);
    rimLight.target.position.set(0, 1.4, 0.2);
    return { key: keyLight, rim: rimLight };
  }, []);

  const { glass, glow } = SCREENS[screen];

  return (
    <group matrixAutoUpdate={false} matrix={view}>
      <ambientLight intensity={0.55} color="#b9b4ff" />
      <primitive object={key} />
      <primitive object={key.target} />
      <primitive object={rim} />
      <primitive object={rim.target} />
      <pointLight position={[1.95, 2.5, -2.3]} intensity={11} color="#ffc98a" />
      <pointLight
        position={[0, 3.1, -1.9]}
        intensity={screen === "warn" ? 7 : 10}
        color={glow}
      />
      <pointLight
        position={[0.3, 1.6, 0.5]}
        intensity={1.6}
        color="#9cc4ff"
        distance={3}
      />

      {/* Floor planks and rug */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-7 + i * 1.75, -0.02, 0.5]} receiveShadow>
          <boxGeometry args={[1.73, 0.04, 12]} />
          <meshStandardMaterial
            color={PLANKS[i % PLANKS.length]}
            roughness={0.75}
          />
        </mesh>
      ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0.1]}
        receiveShadow
      >
        <circleGeometry args={[2.05, 48]} />
        <meshStandardMaterial color="#e9c46a" roughness={0.95} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0.1]}
        receiveShadow
      >
        <circleGeometry args={[1.85, 48]} />
        <meshStandardMaterial color="#2a9d8f" roughness={0.95} />
      </mesh>

      {/* Back wall with a lower panel */}
      <mesh position={[0, 4, -3.2]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#473f86" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6, -3.17]} receiveShadow>
        <boxGeometry args={[14, 1.2, 0.05]} />
        <meshStandardMaterial color="#3a336f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.22, -3.15]}>
        <boxGeometry args={[14, 0.06, 0.08]} />
        <meshStandardMaterial color="#ece6d8" roughness={0.6} />
      </mesh>

      {/* Wall screen with a glow behind it */}
      <group position={[WALL_SCREEN.x, WALL_SCREEN.y, WALL_SCREEN.z]}>
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[WALL_SCREEN.w + 0.5, WALL_SCREEN.h + 0.5]} />
          <meshBasicMaterial color={glow} transparent opacity={0.16} />
        </mesh>
        <mesh position={[0, 0, -0.06]} castShadow>
          <boxGeometry
            args={[WALL_SCREEN.w + 0.12, WALL_SCREEN.h + 0.12, 0.08]}
          />
          <meshStandardMaterial color="#15141b" roughness={0.4} />
        </mesh>
        <mesh>
          <planeGeometry args={[WALL_SCREEN.w, WALL_SCREEN.h]} />
          <meshBasicMaterial
            color={glass}
          />
        </mesh>
        {!bars
          ? null
          : Array.from({ length: 9 }, (_, row) => {
              const slot = (row * 0.12 + frame * 0.012) % (9 * 0.12);
              const long = (0.35 + ((row * 37) % 11) / 11) * 0.9;
              return (
                <mesh
                  key={row}
                  position={[
                    -WALL_SCREEN.w / 2 + 0.14 + long / 2 + (row % 3) * 0.1,
                    WALL_SCREEN.h / 2 - 0.1 - slot,
                    0.005,
                  ]}
                >
                  <planeGeometry args={[long, 0.045]} />
                  <meshBasicMaterial color={CODE[row % CODE.length]} />
                </mesh>
              );
            })}
      </group>

      {/* Sideboard under the screen: keyboard and a PC with a light strip */}
      <mesh position={[0, 0.98, -2.7]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.09, 0.9]} />
        <meshStandardMaterial color="#8b5a3c" roughness={0.6} />
      </mesh>
      {[-1.25, 1.25].map((sx) => (
        <mesh key={sx} position={[sx, 0.47, -2.7]} castShadow>
          <boxGeometry args={[0.1, 0.94, 0.8]} />
          <meshStandardMaterial color="#6f452c" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[-0.2, 1.05, -2.55]}>
        <boxGeometry args={[0.9, 0.04, 0.3]} />
        <meshStandardMaterial color="#e7e5ee" roughness={0.5} />
      </mesh>
      <mesh position={[0.95, 1.33, -2.7]} castShadow>
        <boxGeometry args={[0.32, 0.6, 0.6]} />
        <meshStandardMaterial color="#1c1b24" roughness={0.4} />
      </mesh>
      <mesh position={[0.95, 1.33, -2.39]}>
        <planeGeometry args={[0.05, 0.46]} />
        <meshBasicMaterial color={`hsl(${(frame * 3) % 360}, 90%, 62%)`} />
      </mesh>

      {/* Window, moon and curtains */}
      <group position={[1.75, 4.5, -3.18]}>
        <mesh>
          <boxGeometry args={[1.25, 1.5, 0.06]} />
          <meshStandardMaterial color="#ece6d8" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[1.05, 1.3]} />
          <meshBasicMaterial color="#0d1b3d" />
        </mesh>
        <mesh position={[0.22, 0.28, 0.05]}>
          <circleGeometry args={[0.2, 28]} />
          <meshBasicMaterial color="#fff3c4" />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[0.05, 1.3, 0.02]} />
          <meshStandardMaterial color="#ece6d8" />
        </mesh>
        {[0.72].map((sx) => (
          <mesh key={sx} position={[sx, -0.1, 0.1]} castShadow>
            <boxGeometry args={[0.3, 1.8, 0.08]} />
            <meshStandardMaterial color="#c8553d" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Shelf with books */}
      <mesh position={[-1.3, 4.2, -3.02]} castShadow>
        <boxGeometry args={[1.5, 0.07, 0.3]} />
        <meshStandardMaterial color="#8b5a3c" roughness={0.6} />
      </mesh>
      {["#e76f51", "#f4a261", "#2a9d8f", "#e9c46a", "#7dd3fc", "#c4b5fd"].map(
        (color, i) => (
          <mesh
            key={color}
            position={[-1.9 + i * 0.17, 4.43 + (i % 2) * 0.04, -3.02]}
            castShadow
          >
            <boxGeometry args={[0.13, 0.4 + (i % 2) * 0.08, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        ),
      )}

      {/* Floor lamp */}
      <mesh position={[1.95, 1.15, -2.5]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.3, 8]} />
        <meshStandardMaterial color="#23202b" roughness={0.4} />
      </mesh>
      <mesh position={[1.95, 0.03, -2.5]}>
        <cylinderGeometry args={[0.26, 0.28, 0.06, 20]} />
        <meshStandardMaterial color="#23202b" roughness={0.4} />
      </mesh>
      <mesh position={[1.95, 2.45, -2.5]}>
        <coneGeometry args={[0.36, 0.42, 24, 1, true]} />
        <meshBasicMaterial color="#ffd79a" />
      </mesh>

      {/* Plant */}
      <mesh position={[-1.95, 0.28, -2.55]} castShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.56, 18]} />
        <meshStandardMaterial color="#e76f51" roughness={0.7} />
      </mesh>
      {[
        [0, 0.95, 0, 0.42],
        [-0.25, 0.75, 0.05, 0.3],
        [0.26, 0.8, -0.02, 0.32],
        [0.05, 1.3, 0, 0.3],
      ].map(([px, py, pz, r]) => (
        <mesh
          key={`${px} ${py}`}
          position={[-1.95 + px, py, -2.55 + pz]}
          castShadow
        >
          <sphereGeometry args={[r, 18, 14]} />
          <meshStandardMaterial color="#3fa860" roughness={0.8} />
        </mesh>
      ))}

      {/* The robot's table, with a laptop and a mug */}
      <mesh
        position={[TABLE.x, TABLE.top - 0.035, TABLE.z]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.3, 0.07, 0.85]} />
        <meshStandardMaterial color="#d9b48a" roughness={0.55} />
      </mesh>
      {[
        [-0.57, -0.35],
        [0.57, -0.35],
        [-0.57, 0.35],
        [0.57, 0.35],
      ].map(([tx, tz]) => (
        <mesh
          key={`${tx} ${tz}`}
          position={[TABLE.x + tx, (TABLE.top - 0.07) / 2, TABLE.z + tz]}
          castShadow
        >
          <cylinderGeometry args={[0.03, 0.025, TABLE.top - 0.07, 10]} />
          <meshStandardMaterial color="#23202b" roughness={0.4} />
        </mesh>
      ))}
      <group
        position={[TABLE.x - 0.44, TABLE.top, TABLE.z + 0.2]}
        rotation={[0, 0.9, 0]}
      >
        <mesh position={[0, 0.01, 0]} castShadow>
          <boxGeometry args={[0.36, 0.02, 0.26]} />
          <meshStandardMaterial
            color="#c9c9d2"
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>
        <mesh position={[0, 0.13, -0.15]} rotation={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.36, 0.25, 0.012]} />
          <meshStandardMaterial
            color="#c9c9d2"
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>
        <mesh position={[0, 0.13, -0.143]} rotation={[-0.3, 0, 0]}>
          <planeGeometry args={[0.33, 0.22]} />
          <meshBasicMaterial color="#9cc4ff" />
        </mesh>
      </group>
      <mesh
        position={[TABLE.x - 0.5, TABLE.top + 0.07, TABLE.z - 0.25]}
        castShadow
      >
        <cylinderGeometry args={[0.055, 0.05, 0.14, 16]} />
        <meshStandardMaterial color="#f4f4f6" roughness={0.4} />
      </mesh>

      {children}
    </group>
  );
};
