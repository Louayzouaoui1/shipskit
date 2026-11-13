import type { Key, Pose } from "./cast/Rig";
import type { Episode, Plan, Shot, TimedLine, Who } from "./types";

// The director: turns the lines of an episode into camera cuts, pose keys, screen changes
// and sounds. Each act is a short list of poses that are known to read well and to keep
// hands out of heads and bodies, timed from the line they belong to.

export const FPS = 30;
const LEAD = 6; // frames before the first word
const GAP = 4; // pause between two lines
const TAIL = 45; // hold after the last word

/** When each line starts and how long it lasts, from the length of its recording. */
export const timeline = (episode: Episode, seconds: number[]) => {
  const lines: TimedLine[] = [];
  let cursor = LEAD;
  episode.lines.forEach((line, i) => {
    const frames = Math.ceil((seconds[i] ?? 0) * FPS);
    lines.push({ ...line, start: cursor, frames });
    cursor += frames + GAP + (line.pause ?? 0);
  });
  return { lines, total: cursor + TAIL };
};

type Step = { t: number; pose: Partial<Pose>; ease?: number };
/** `n` is the length of the line in frames; `t` counts from its first word. */
type Act = { mood: "tense" | "calm" | "happy"; steps: (n: number) => Step[] };

// Hands are [outward, up-is-negative] from the hips.
const up = { hLx: 68, hLy: -150, hRx: 68, hRy: -150 };
const hips = { hLx: 46, hLy: -8, hRx: 46, hRy: -8 };
const waiting = { hLx: 54, hLy: -74, hRx: 54, hRy: -74 };
const onHead = { hLx: 24, hLy: -150, hRx: 24, hRy: -150 };
const fists = { hLx: 86, hLy: -118, hRx: 86, hRy: -118 };
const atScreen = { hLx: 54, hLy: -40, hRx: 54, hRy: -40, lookY: -0.8 };

// The developer faces right: lookX 0.8 looks at the robot. He points with the right hand.
const D = { lookX: 0.8 };
const DEV: Record<string, Act> = {
  talk: {
    mood: "calm",
    steps: (n) => [
      { t: 0, pose: { ...D, hRx: 80, hRy: -92, brow: 0.3 } },
      { t: n * 0.5, pose: { ...D, ...waiting, brow: 0.2, lean: 4 } },
    ],
  },
  panic: {
    mood: "tense",
    steps: (n) => [
      {
        t: 0,
        pose: { ...D, ...onHead, eye: 1.4, brow: 0.8, gasp: 0.3, shake: 0.3 },
        ease: 6,
      },
      {
        t: n * 0.6,
        pose: {
          ...D,
          hLx: 80,
          hLy: -92,
          hRx: 80,
          hRy: -92,
          brow: 0.6,
          eye: 1.25,
          shake: 0.25,
          lean: 5,
        },
      },
    ],
  },
  shout: {
    mood: "tense",
    steps: () => [
      { t: -3, pose: { ...D, crouch: 22 }, ease: 3 },
      {
        t: 0,
        // No lean: in the tight shot it would carry the head out of the frame.
        pose: { ...D, ...fists, shake: 1, brow: -1, eye: 1.2 },
        ease: 5,
      },
    ],
  },
  point: {
    mood: "calm",
    steps: () => [
      {
        t: 0,
        pose: { ...D, hRx: 108, hRy: -70, brow: -0.4, eye: 1.15, lean: 6 },
      },
    ],
  },
  plead: {
    mood: "tense",
    steps: () => [
      {
        t: 0,
        pose: {
          ...D,
          hLx: 70,
          hLy: -88,
          hRx: 70,
          hRy: -88,
          brow: 0.9,
          eye: 1.3,
          lean: 9,
        },
      },
    ],
  },
  facepalm: {
    mood: "calm",
    steps: () => [
      {
        t: 0,
        pose: { hLx: 8, hLy: -142, eye: 0.25, lookY: 0.5, tilt: 6, smile: -0.4 },
        ease: 10,
      },
    ],
  },
  think: {
    mood: "calm",
    steps: () => [
      {
        t: 0,
        pose: { ...hips, tilt: 8, lookX: 0.2, lookY: -0.6, brow: 0.5 },
        ease: 12,
      },
    ],
  },
  shrug: {
    mood: "calm",
    steps: () => [
      {
        t: 0,
        pose: {
          ...D,
          hLx: 84,
          hLy: -60,
          hRx: 84,
          hRy: -60,
          brow: 0.8,
          tilt: -6,
          smile: 0,
        },
      },
    ],
  },
  cheer: {
    mood: "happy",
    steps: () => [
      { t: -3, pose: { ...D, crouch: 22 }, ease: 3 },
      { t: 0, pose: { ...D, ...up, hop: 50, smile: 1, eye: 1.2 }, ease: 6 },
      { t: 12, pose: { ...D, ...up, smile: 1 }, ease: 8 },
    ],
  },
  relief: {
    mood: "happy",
    steps: () => [
      { t: 0, pose: { ...D, ...hips, smile: 0.8, lean: -5, eye: 0.9 }, ease: 14 },
    ],
  },
  despair: {
    mood: "tense",
    steps: () => [
      {
        t: 0,
        pose: {
          ...onHead,
          crouch: 72,
          lookY: 0.6,
          eye: 1.4,
          brow: 0.9,
          gasp: 0.6,
        },
        ease: 10,
      },
    ],
  },
  look: {
    mood: "calm",
    steps: () => [
      { t: 0, pose: { ...atScreen, lookX: 0.25, eye: 1.3, brow: 0.7 }, ease: 10 },
    ],
  },
};

// The robot looks at the developer with lookX -0.7 and points with the left hand.
const B = { lookX: -0.7 };
const BOT: Record<string, Act> = {
  talk: {
    mood: "calm",
    steps: (n) => [
      { t: 0, pose: { ...B, hLx: 70, hLy: -80 } },
      { t: n * 0.5, pose: { ...B, hRx: 70, hRy: -80, tilt: 4 } },
    ],
  },
  explain: {
    mood: "calm",
    steps: (n) => [
      {
        t: 0,
        pose: { ...B, hLx: 80, hLy: -92, hRx: 80, hRy: -92, lean: -4 },
      },
      { t: n * 0.5, pose: { ...B, hLx: 96, hLy: -90, tilt: 5, eye: 1.1 } },
    ],
  },
  point: {
    mood: "calm",
    steps: () => [
      { t: 0, pose: { ...B, hLx: 96, hLy: -90, lean: -6, eye: 1.15 } },
    ],
  },
  type: {
    mood: "calm",
    steps: () => [
      {
        t: 0,
        pose: {
          hLx: 30,
          hLy: -96,
          hRx: 30,
          hRy: -96,
          typing: 1,
          lookX: -0.2,
          lookY: 0.5,
          eye: 0.7,
        },
      },
    ],
  },
  proud: {
    mood: "happy",
    steps: () => [
      { t: 0, pose: { ...B, ...hips, hop: 14, tilt: -5 }, ease: 5 },
      { t: 8, pose: { ...B, ...hips, tilt: -5, eye: 0.9 } },
    ],
  },
  cheer: {
    mood: "happy",
    steps: () => [
      { t: -3, pose: { ...B, crouch: 26 }, ease: 3 },
      { t: 0, pose: { ...B, ...up, hop: 34, eye: 1.2 }, ease: 6 },
      { t: 12, pose: { ...B, ...up, eye: 1.1 }, ease: 8 },
    ],
  },
  think: {
    mood: "calm",
    steps: () => [
      { t: 0, pose: { tilt: 8, lookX: -0.2, lookY: -0.6 }, ease: 12 },
    ],
  },
  alarm: {
    mood: "tense",
    steps: () => [
      { t: 0, pose: { ...B, ...up, shake: 0.8, eye: 1.3 }, ease: 5 },
    ],
  },
  off: {
    mood: "tense",
    steps: (n) => [
      { t: 0, pose: { ...B, power: 0.55, crouch: 14, eye: 0.5, tilt: 6 } },
      {
        t: n + 2,
        pose: { power: 0, crouch: 34, lookX: -0.3, lookY: 0.7, eye: 0.05 },
        ease: 14,
      },
    ],
  },
  look: {
    mood: "calm",
    steps: () => [{ t: 0, pose: { ...atScreen, lookX: -0.2 }, ease: 10 }],
  },
};

// What the one who is not talking does, by the mood of the one who is.
const LISTEN: Record<Who, Record<Act["mood"], Partial<Pose>>> = {
  dev: {
    tense: { ...D, ...waiting, eye: 1.3, brow: 0.7, lean: 6 },
    calm: { ...D, ...hips, brow: 0.3, tilt: 4 },
    happy: { ...D, ...hips, smile: 0.8, eye: 1.1 },
  },
  bot: {
    tense: { ...B, hLx: 60, hLy: -50, hRx: 60, hRy: -50, eye: 1.3, lean: 5 },
    calm: { ...B, tilt: -4 },
    happy: { ...B, tilt: 5, eye: 1.1, hop: 6 },
  },
};
const POWERED_DOWN: Partial<Pose> = {
  power: 0,
  crouch: 34,
  lookX: -0.3,
  lookY: 0.7,
  eye: 0.05,
};

const SKID: Partial<Pose> = {
  lean: 18,
  crouch: 22,
  lookX: 0.8,
  hLx: 78,
  hLy: -30,
  hRx: 78,
  hRy: -30,
  eye: 1.35,
  brow: 0.7,
  gasp: 0.3,
};

export const direct = (episode: Episode, lines: TimedLine[]): Plan => {
  const plan: Plan = { cuts: [], dev: [], bot: [], screen: [], sounds: [] };
  const keys: Record<Who, Key[]> = { dev: plan.dev, bot: plan.bot };
  const skid = episode.hook === "skid";
  const first = skid ? 12 : 0; // nobody moves before the skid has landed
  let botOff = false;

  plan.cuts.push({ at: 0, shot: "wide" });
  plan.bot.push({ at: 0, pose: B, ease: 1 });
  plan.dev.push({ at: 0, pose: skid ? SKID : D, ease: 1 });
  if (skid) plan.sounds.push({ at: 0, name: "whoosh", volume: 0.5 });
  if (!lines[0]?.screen) plan.screen.push({ at: 0, state: "code" });

  lines.forEach((line, i) => {
    const { start, frames: n, who } = line;
    const other: Who = who === "dev" ? "bot" : "dev";
    const acts = who === "dev" ? DEV : BOT;
    const act = acts[line.act ?? "talk"] ?? acts.talk;
    const lastLine = i === lines.length - 1;

    // Camera: cut to whoever speaks, on the first word.
    const speaker: Shot =
      who === "bot" ? "bot" : line.act === "shout" ? "devTight" : "dev";
    const closing: Shot | undefined = !lastLine
      ? undefined
      : line.act === "despair"
        ? "high"
        : episode.endCard
          ? "wide"
          : undefined;
    // New words on the wall screen are always shown, or a close-up would hide them. The first
    // and last lines are wide shots, where the screen is in view anyway.
    const showScreen =
      line.shot === "screen" || (!!line.screen?.lines && i > 0 && !closing);
    if (showScreen) {
      plan.cuts.push({ at: i === 0 ? 0 : start, shot: "screen" });
      const back = start + Math.min(Math.max(36, Math.round(n * 0.5)), 75);
      if (back < start + n - 12)
        plan.cuts.push({ at: back, shot: closing ?? speaker });
    } else if (i === 0) {
      if (n > 50)
        plan.cuts.push({ at: start + Math.round(n * 0.55), shot: speaker });
    } else {
      plan.cuts.push({ at: start, shot: closing ?? speaker });
    }

    // The speaker acts, the other one reacts and shifts once in the middle.
    if (who === "bot") botOff = false;
    for (const step of act.steps(n))
      keys[who].push({
        at: Math.max(first, Math.round(start + step.t)),
        pose: step.pose,
        ease: step.ease,
      });
    if (who === "bot" && line.act === "off") botOff = true;

    const listen =
      other === "bot" && botOff ? POWERED_DOWN : LISTEN[other][act.mood];
    const watching = line.screen && !(other === "bot" && botOff);
    keys[other].push({
      at: Math.max(first, start),
      pose: watching
        ? { ...atScreen, lookX: other === "dev" ? 0.25 : -0.2, eye: 1.2 }
        : listen,
      ease: 10,
    });
    if (n > 40)
      keys[other].push({
        at: start + Math.round(n * 0.6),
        pose:
          listen === POWERED_DOWN
            ? listen
            : { ...listen, tilt: -(listen.tilt ?? 3) },
        ease: 12,
      });

    if (line.screen) plan.screen.push({ at: i === 0 ? 0 : start, ...line.screen });
    if (line.sound) plan.sounds.push({ at: start, name: line.sound });
    if (who === "bot" && line.act === "type")
      plan.sounds.push({
        at: start,
        name: "typing",
        volume: 0.3,
        frames: Math.min(n, 40),
      });
    if (who === "bot" && line.act === "off")
      plan.sounds.push({ at: start + n, name: "powerdown", volume: 0.6 });
  });

  // poseAt walks the keys in order, so they must be sorted by time.
  plan.dev.sort((a, b) => a.at - b.at);
  plan.bot.sort((a, b) => a.at - b.at);
  plan.cuts.sort((a, b) => a.at - b.at);
  return plan;
};
