// Reads and checks an episode.json. The checks are here so that a mistake is caught before
// any voice is paid for, and so that nothing is drawn wider than the place it is drawn in.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const vocab = JSON.parse(
  readFileSync(new URL("../src/vocab.json", import.meta.url), "utf8"),
);

const isText = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const extra = (object, allowed) =>
  Object.keys(object).filter((key) => !allowed.includes(key));

/** Returns a list of problems; an empty list means the episode can be made. */
export function problems(ep) {
  const out = [];
  const bad = (message) => out.push(message);
  if (!ep || typeof ep !== "object" || Array.isArray(ep))
    return ["The episode must be a JSON object."];
  for (const key of extra(ep, ["title", "badge", "hook", "countdown", "endCard", "music", "lines"]))
    bad(`Unknown field "${key}".`);
  if (!isText(ep.title, 80)) bad("title: text of up to 80 characters is required.");
  if (ep.badge !== undefined && !isText(ep.badge, 28)) bad("badge: up to 28 characters.");
  if (ep.hook !== undefined && ep.hook !== "skid") bad('hook: only "skid" is known.');
  if (ep.endCard !== undefined && !isText(ep.endCard, 40)) bad("endCard: up to 40 characters.");
  if (ep.music !== undefined && typeof ep.music !== "boolean") bad("music: true or false.");
  if (ep.countdown !== undefined) {
    const c = ep.countdown ?? {};
    if (!Number.isInteger(c.seconds) || c.seconds < 5 || c.seconds > 3600)
      bad("countdown.seconds: a whole number from 5 to 3600.");
    if (!isText(c.label, 12)) bad("countdown.label: up to 12 characters.");
  }
  if (!Array.isArray(ep.lines) || ep.lines.length < 2 || ep.lines.length > 14)
    return [...out, "lines: 2 to 14 lines are required."];

  let wordsOnScreen = false;
  ep.lines.forEach((line, i) => {
    const at = `lines[${i}]`;
    if (!line || typeof line !== "object") return bad(`${at}: must be an object.`);
    for (const key of extra(line, ["who", "text", "act", "pause", "screen", "shot", "sound"]))
      bad(`${at}: unknown field "${key}".`);
    if (line.who !== "dev" && line.who !== "bot") return bad(`${at}.who: "dev" or "bot".`);
    if (!isText(line.text, 110)) bad(`${at}.text: 1 to 110 characters.`);
    else {
      const words = line.text.split(/\s+/);
      if (words.length > 18) bad(`${at}.text: ${words.length} words; keep a line to 18.`);
      const long = words.find((word) => word.length > 14);
      if (long) bad(`${at}.text: "${long}" is too long for a caption (14 characters a word).`);
    }
    const acts = line.who === "dev" ? vocab.devActs : vocab.botActs;
    if (line.act !== undefined && !acts.includes(line.act))
      bad(`${at}.act: "${line.act}" is not one of ${acts.join(", ")}.`);
    if (line.pause !== undefined && (!Number.isInteger(line.pause) || line.pause < 0 || line.pause > 120))
      bad(`${at}.pause: a whole number of frames from 0 to 120.`);
    if (line.sound !== undefined && !vocab.sounds.includes(line.sound))
      bad(`${at}.sound: "${line.sound}" is not one of ${vocab.sounds.join(", ")}.`);
    if (line.screen !== undefined) {
      const s = line.screen ?? {};
      for (const key of extra(s, ["state", "lines", "blink"]))
        bad(`${at}.screen: unknown field "${key}".`);
      if (!vocab.screens.includes(s.state))
        bad(`${at}.screen.state: one of ${vocab.screens.join(", ")}.`);
      if (s.blink !== undefined && typeof s.blink !== "boolean") bad(`${at}.screen.blink: true or false.`);
      wordsOnScreen = false;
      if (s.lines !== undefined) {
        const diff = s.state === "diff";
        const most = diff ? 6 : 3;
        if (!Array.isArray(s.lines) || s.lines.length < 1 || s.lines.length > most)
          bad(`${at}.screen.lines: 1 to ${most} lines.`);
        else {
          wordsOnScreen = true;
          s.lines.forEach((text, n) => {
            const max = diff ? 30 : n === 0 ? 18 : 26;
            if (!isText(text, max))
              bad(`${at}.screen.lines[${n}]: 1 to ${max} characters, or it runs off the screen.`);
          });
        }
      }
    }
    if (line.shot !== undefined && line.shot !== "screen") bad(`${at}.shot: only "screen" is known.`);
    if (line.shot === "screen" && !wordsOnScreen)
      bad(`${at}.shot: the screen has no words to show; give this line a screen with lines.`);
  });
  return out;
}

/** Loads `<dir>/episode.json` or throws with every problem listed. */
export function load(dir) {
  const file = join(dir, "episode.json");
  let ep;
  try {
    ep = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`);
  }
  const found = problems(ep);
  if (found.length) throw new Error(`${file} has problems:\n- ${found.join("\n- ")}`);
  return ep;
}
