// Voices: one WAV per line, plus how long each is and how open the mouth is on every frame.
// Gemini speech is used when GEMINI_API_KEY is set; without it, macOS `say` is used.
// SHIPSKIT_TTS=vertex uses the same Gemini voices through Google Cloud (gcloud signed in).
// A line that already has a recording is not made again.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FPS = 30;
const QUIET = 500; // 16-bit samples below this count as silence
const PAD_SECONDS = 0.05;
const VOICES = {
  gemini: { dev: "Fenrir", bot: "Aoede" },
  say: { dev: "Daniel", bot: "Samantha" },
};
VOICES.vertex = VOICES.gemini;

function provider() {
  const asked = process.env.SHIPSKIT_TTS;
  if (asked && !VOICES[asked]) throw new Error(`SHIPSKIT_TTS must be "gemini", "vertex" or "say".`);
  if (asked) return asked;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.platform === "darwin") return "say";
  throw new Error("No voice available: set GEMINI_API_KEY (Gemini speech).");
}

const gcloud = (...args) => execFileSync("gcloud", args, { encoding: "utf8" }).trim();
let vertex; // the project and token, asked for once

async function gemini(text, voiceName, onVertex) {
  const model = encodeURIComponent(process.env.SHIPSKIT_TTS_MODEL || "gemini-3.8-flash-tts");
  let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let auth = { "x-goog-api-key": process.env.GEMINI_API_KEY };
  if (onVertex) {
    vertex ??= {
      project: process.env.GOOGLE_CLOUD_PROJECT || gcloud("config", "get-value", "project"),
      token: gcloud("auth", "print-access-token"),
    };
    if (!/^[a-z][a-z0-9-]{4,29}$/.test(vertex.project)) throw new Error("No Google Cloud project is set.");
    url = `https://aiplatform.googleapis.com/v1/projects/${vertex.project}/locations/global/publishers/google/models/${model}:generateContent`;
    auth = { Authorization: `Bearer ${vertex.token}` };
  } else if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
  const res = await fetch(
    url,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Only the line itself: a style note in front of it would be read out loud.
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`Gemini speech ${res.status}: ${JSON.stringify(body.error?.message ?? body).slice(0, 300)}`);
  const audio = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!audio) throw new Error(`Gemini speech returned no audio for: ${text}`);
  const bytes = Buffer.from(audio.data, "base64");
  if (audio.mimeType === "audio/wav") return unwrapWav(bytes);
  const rate = Number(/rate=(\d+)/.exec(audio.mimeType)?.[1]);
  if (!rate) throw new Error(`Unexpected audio type: ${audio.mimeType}`);
  return { pcm: bytes, rate };
}

function say(text, voiceName) {
  const file = join(tmpdir(), `shipskit-${process.pid}.wav`);
  try {
    // The line goes in on standard input, so it can never be read as an option.
    execFileSync("say", ["-v", voiceName, "-o", file, "--data-format=LEI16@24000"], { input: text });
    return unwrapWav(readFileSync(file));
  } finally {
    rmSync(file, { force: true });
  }
}

/** Reads the sample rate and the samples out of a WAV file. Only 16-bit mono PCM is accepted. */
function unwrapWav(file) {
  let rate = 0;
  for (let at = 12; at + 8 <= file.length; ) {
    const name = file.toString("latin1", at, at + 4);
    const size = file.readUInt32LE(at + 4);
    if (name === "fmt ") {
      const [format, channels, bits] = [at + 8, at + 10, at + 22].map((o) => file.readUInt16LE(o));
      if (format !== 1 || channels !== 1 || bits !== 16)
        throw new Error(`Unexpected WAV: format ${format}, ${channels} channels, ${bits} bits`);
      rate = file.readUInt32LE(at + 12);
    }
    if (name === "data" && rate)
      return { pcm: file.subarray(at + 8, Math.min(file.length, at + 8 + size)), rate };
    at += 8 + size + (size % 2);
  }
  throw new Error("WAV without fmt and data chunks");
}

/** Cuts the silence at both ends of 16-bit mono PCM, leaving a short pad. */
function trim(pcm, rate) {
  const count = Math.floor(pcm.length / 2);
  let first = 0;
  let last = count - 1;
  while (first < count && Math.abs(pcm.readInt16LE(first * 2)) < QUIET) first++;
  while (last > first && Math.abs(pcm.readInt16LE(last * 2)) < QUIET) last--;
  const pad = Math.round(PAD_SECONDS * rate);
  return pcm.subarray(Math.max(0, first - pad) * 2, Math.min(count, last + pad) * 2);
}

function wav(pcm, rate) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** How open the mouth is on each video frame (0 to 1), from how loud the recording is. */
function lips(pcm, rate) {
  const step = Math.round(rate / FPS);
  const count = Math.floor(pcm.length / 2);
  const loud = [];
  for (let from = 0; from < count; from += step) {
    const to = Math.min(count, from + step);
    let sum = 0;
    for (let i = from; i < to; i++) sum += pcm.readInt16LE(i * 2) ** 2;
    loud.push(Math.sqrt(sum / (to - from)));
  }
  const top = Math.max(...loud, 1);
  return loud.map((v) => Number(Math.min(1, (v / top) * 1.6).toFixed(2)));
}

/** Records every line of the episode into `<dir>/public/voice` and writes `<dir>/clips.json`. */
export async function voice(dir, episode) {
  const using = provider();
  const out = join(dir, "public", "voice");
  mkdirSync(out, { recursive: true });
  const clips = [];
  for (const line of episode.lines) {
    const name = VOICES[using][line.who];
    const hash = createHash("sha1").update(`${using}|${name}|${line.text}`).digest("hex").slice(0, 12);
    const file = join(out, `${hash}.wav`);
    if (!existsSync(file)) {
      const { pcm, rate } = using === "say" ? say(line.text, name) : await gemini(line.text, name, using === "vertex");
      const cut = trim(pcm, rate);
      if (cut.length < rate / 5) throw new Error(`The recording of "${line.text}" came back empty.`);
      writeFileSync(file, wav(cut, rate));
      console.log(`voice (${using}, ${name}): ${line.text}`);
    }
    const { pcm, rate } = unwrapWav(readFileSync(file));
    clips.push({
      file: `${hash}.wav`,
      text: line.text,
      seconds: Number((pcm.length / 2 / rate).toFixed(3)),
      lips: lips(pcm, rate),
    });
  }
  writeFileSync(join(dir, "clips.json"), JSON.stringify(clips) + "\n");
  return clips;
}
