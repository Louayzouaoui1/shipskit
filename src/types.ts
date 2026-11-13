import type { Key } from "./cast/Rig";
import type { ScreenState } from "./cast/Studio";

// An episode is data. `episode.json` is what a person or a model writes: who says what, how
// they act, what the wall screen shows. The director (director.ts) turns that into the
// frame-by-frame plan the player follows, so every pose on screen is one that has been checked.

export type Who = "dev" | "bot";

export type EpisodeLine = {
  who: Who;
  text: string;
  /** How the speaker acts while saying it; names are in vocab.json. */
  act?: string;
  /** Silent frames after the line, for a beat with no talking. */
  pause?: number;
  /** What the wall screen changes to when the line starts. */
  screen?: { state: ScreenState; lines?: string[]; blink?: boolean };
  /** "screen" opens the line on the wall screen before cutting to the speaker. */
  shot?: "screen";
  /** A sound from vocab.json played when the line starts. */
  sound?: string;
};

export type Episode = {
  title: string;
  /** A chip that stays at the top, for example "PR #42 · +38 −4". */
  badge?: string;
  /** "skid": the developer slides in on the first frames. */
  hook?: "skid";
  /** A stakes clock that runs for the whole video. */
  countdown?: { seconds: number; label: string };
  /** Words over the last second and a half. */
  endCard?: string;
  music?: boolean;
  lines: EpisodeLine[];
};

/** One recording per line, in the same order (made by `shipskit voice`). */
export type Clip = { file: string; seconds: number; lips: number[] };

export type EpisodeProps = { episode: Episode; clips: Clip[] };

export type Shot = "wide" | "dev" | "devTight" | "bot" | "screen" | "high";

export type TimedLine = EpisodeLine & { start: number; frames: number };

export type Plan = {
  cuts: { at: number; shot: Shot }[];
  dev: Key[];
  bot: Key[];
  screen: { at: number; state: ScreenState; lines?: string[]; blink?: boolean }[];
  sounds: { at: number; name: string; volume?: number; frames?: number }[];
};
