// Makes every sound in public/ from maths, so nothing is downloaded and everything in the
// repository can be shared under its licence. Run: npm run sounds
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 44100;
const TAU = Math.PI * 2;
let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};

/** Writes mono samples (-1 to 1) as a 16-bit WAV, scaled so the loudest is `peak`. */
function save(path, samples, peak = 0.8) {
  const top = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) =>
    pcm.writeInt16LE(Math.round((v / top) * peak * 32767), i * 2),
  );
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([head, pcm]));
}

/** `seconds` of sound from a function of time and progress (0 to 1). */
const make = (seconds, fn) =>
  Array.from({ length: Math.round(seconds * RATE) }, (_, i) =>
    fn(i / RATE, i / (seconds * RATE)),
  );
/** A tone whose pitch slides from `from` to `to` hertz. */
const sweep = (seconds, from, to, shape = (p) => 1 - p) => {
  let phase = 0;
  return make(seconds, (_, p) => {
    phase += (TAU * (from + (to - from) * p)) / RATE;
    return Math.sin(phase) * shape(p);
  });
};

mkdirSync("public/sfx", { recursive: true });
mkdirSync("public/music", { recursive: true });

save(
  "public/sfx/ding.wav",
  make(0.7, (t) => (Math.sin(TAU * 880 * t) + 0.5 * Math.sin(TAU * 1320 * t)) * Math.exp(-6 * t)),
);
save("public/sfx/pop.wav", sweep(0.09, 300, 950, (p) => (1 - p) ** 2));
save(
  "public/sfx/thud.wav",
  sweep(0.4, 115, 42, (p) => (1 - p) ** 2).map((v, i) => v + (i < 900 ? noise() * 0.5 * (1 - i / 900) : 0)),
);
save("public/sfx/powerdown.wav", sweep(0.9, 440, 55, (p) => (1 - p) * (0.75 + 0.25 * Math.sin(p * 60))));
{
  // Whoosh: noise through a filter that opens and closes.
  let low = 0;
  save(
    "public/sfx/whoosh.wav",
    make(0.55, (_, p) => {
      const open = 0.02 + 0.3 * Math.sin(Math.PI * p) ** 2;
      low += open * (noise() - low);
      return low * Math.sin(Math.PI * p) ** 1.5;
    }),
  );
}
save(
  "public/sfx/alarm.wav",
  make(0.9, (t, p) => {
    const f = Math.floor(t / 0.15) % 2 ? 660 : 880;
    return (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 3 * t)) * Math.min(1, (1 - p) * 8);
  }),
  0.6,
);
{
  // Typing: a run of short clicks, unevenly spaced.
  const out = new Array(Math.round(1.4 * RATE)).fill(0);
  for (let at = 0.02; at < 1.35; at += 0.07 + Math.abs(noise()) * 0.09) {
    const start = Math.round(at * RATE);
    const loud = 0.6 + Math.abs(noise()) * 0.4;
    for (let i = 0; i < 260; i++) out[start + i] += noise() * loud * Math.exp(-i / 45);
  }
  save("public/sfx/typing.wav", out, 0.7);
}
{
  // Music: eight bars of plucked chords over a soft bass and a tick, made to loop.
  const beat = 60 / 100;
  const total = Math.round(32 * beat * RATE);
  const out = new Array(total).fill(0);
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  const add = (at, seconds, fn) => {
    const start = Math.round(at * RATE);
    const n = Math.round(seconds * RATE);
    for (let i = 0; i < n; i++) out[(start + i) % total] += fn(i / RATE, i / n);
  };
  const triangle = (x) => (2 / Math.PI) * Math.asin(Math.sin(x));
  const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]]; // Am7 Fmaj7 C G
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4];
    for (let step = 0; step < 8; step++) {
      const at = (bar * 4 + step * 0.5) * beat;
      const f = hz(chord[[0, 2, 1, 3, 2, 1, 3, 2][step]] + 12);
      add(at, 0.5, (t) => triangle(TAU * f * t) * Math.exp(-7 * t) * 0.5);
      if (step % 2) add(at, 0.04, (_, p) => noise() * (1 - p) * 0.12);
    }
    for (const b of [0, 2]) {
      const f = hz(chord[0] - 12);
      add((bar * 4 + b) * beat, 1.1, (t, p) => Math.sin(TAU * f * t) * (1 - p) * 0.7);
    }
  }
  save("public/music/loop.wav", out, 0.6);
}
console.log("made public/sfx and public/music");
