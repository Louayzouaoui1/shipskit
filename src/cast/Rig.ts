// An animated cartoon character: a pose is a handful of numbers (where the hands are, how
// far the body leans, how wide the eyes are...), and the drawing is rebuilt from them on
// every frame. Moving between poses, talking, blinking and breathing all come from that.

export type Pose = {
  /** Body lean in degrees, positive to the right. */
  lean: number;
  /** How far the hips drop, bending the knees. */
  crouch: number;
  /** Height off the ground. */
  hop: number;
  /** Rotation of the whole character about its feet, for falling over. */
  spin: number;
  tilt: number;
  lookX: number;
  lookY: number;
  /** Hand positions from the hip centre. x is outward from the body, y is up when negative. */
  hLx: number;
  hLy: number;
  hRx: number;
  hRy: number;
  /** -1 angry, 0 relaxed, 1 raised. */
  brow: number;
  /** 1 normal, below squinting, above wide open. */
  eye: number;
  /** -1 frown to 1 smile, when not talking. */
  smile: number;
  /** 0 to 1: mouth held open in a round shape (gasp, scream). */
  gasp: number;
  /** 0 to 1: trembling with anger or fear. */
  shake: number;
  /** 0 to 1: hands drumming, as if typing in the air. */
  typing: number;
  /** 1 switched on, 0 switched off (used by the robot). */
  power: number;
};

export const REST: Pose = {
  lean: 0,
  crouch: 0,
  hop: 0,
  spin: 0,
  tilt: 0,
  lookX: 0,
  lookY: 0,
  hLx: 50,
  hLy: 6,
  hRx: 50,
  hRy: 6,
  brow: 0,
  eye: 1,
  smile: 0.2,
  gasp: 0,
  shake: 0,
  typing: 0,
  power: 1,
};

export type Key = { at: number; pose: Partial<Pose>; ease?: number };

const overshoot = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/** The pose at a frame: each key is reached from the one before with a small overshoot. */
export const poseAt = (keys: Key[], frame: number): Pose => {
  let pose = REST;
  for (const key of keys) {
    if (frame < key.at) break;
    const target = { ...REST, ...key.pose };
    const t = overshoot((frame - key.at) / (key.ease ?? 9));
    const next = { ...pose };
    for (const name of Object.keys(REST) as (keyof Pose)[])
      next[name] = pose[name] + (target[name] - pose[name]) * t;
    pose = next;
  }
  return pose;
};

type Point = [number, number];

/** The middle joint of a two-part limb, bent outward. `side` is -1 for left, 1 for right. */
export const joint = (
  from: Point,
  to: Point,
  a: number,
  b: number,
  side: number,
): [Point, Point] => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const reach = Math.max(8, Math.min(a + b - 1, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const bend = Math.acos((a * a + reach * reach - b * b) / (2 * a * reach));
  const options = [base + bend, base - bend].map(
    (angle): Point => [
      from[0] + a * Math.cos(angle),
      from[1] + a * Math.sin(angle),
    ],
  );
  const mid =
    options[0][0] * side > options[1][0] * side ? options[0] : options[1];
  const end: Point = [
    from[0] + (dx / Math.hypot(dx, dy)) * reach,
    from[1] + (dy / Math.hypot(dx, dy)) * reach,
  ];
  return [mid, end];
};

