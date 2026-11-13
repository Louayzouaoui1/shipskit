import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont } from "@remotion/google-fonts/Baloo2";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PerspectiveCamera, Vector3 } from "three";
import { Bit3D } from "./cast/Bit3D";
import { Dev3D } from "./cast/Dev3D";
import { poseAt } from "./cast/Rig";
import { Studio, TABLE, WALL_SCREEN } from "./cast/Studio";
import { direct, timeline } from "./director";
import type { EpisodeProps, Shot } from "./types";

// Plays an episode: the developer and Bit in the room, with the camera, captions, wall
// screen and sounds driven by the director's plan.
const { fontFamily } = loadFont("normal", {
  weights: ["800"],
  subsets: ["latin"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

const INK = "#2a2233";
const FOV = 40;
const DEV_X = -0.62;
const BOT_X = TABLE.x + 0.06;
const BOT_Z = TABLE.z + 0.25;
const STAND_Z = 0.1;

type V3 = [number, number, number];
const CAMS: Record<Shot, { pos: V3; target: V3 }> = {
  wide: { pos: [0.45, 1.95, 6.2], target: [0.08, 1.45, 0] },
  dev: { pos: [DEV_X + 1.0, 1.85, 3.0], target: [DEV_X, 1.62, STAND_Z] },
  devTight: { pos: [DEV_X + 0.6, 1.75, 2.1], target: [DEV_X, 1.64, STAND_Z] },
  bot: { pos: [BOT_X - 0.5, 1.72, 2.5], target: [BOT_X, 1.42, BOT_Z] },
  screen: {
    pos: [0, WALL_SCREEN.y, 2.0],
    target: [0, WALL_SCREEN.y, WALL_SCREEN.z],
  },
  high: { pos: [0.55, 4.4, 4.8], target: [0.25, 1.0, 0] },
};
const SCREEN_INK = {
  code: "#86efac",
  diff: "#e5e7eb",
  crash: "#ffffff",
  warn: "#ffcf8a",
  pass: "#86efac",
};

/** 0 to 1 from `start` over `dur` frames, eased out and clamped. */
const enter = (frame: number, start: number, dur = 12) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
const last = <T,>(items: T[]): T | undefined => items[items.length - 1];
const sayLength = (word: string) =>
  word.replace(/[^\dA-Za-z]/g, "").length + (/[.,!?]$/.test(word) ? 4 : 1.5);
const chip = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "14px 34px",
  borderRadius: 20,
  backgroundColor: "rgb(20 16 40 / 0.88)",
  fontFamily: mono,
  fontWeight: 700,
  color: "#ffffff",
} as const;

export const EpisodeVideo = ({ episode, clips }: EpisodeProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Everything that depends only on the episode, worked out once.
  const { lines, total, plan, words } = useMemo(() => {
    const timed = timeline(
      episode,
      clips.map((clip) => clip.seconds),
    );
    // One caption word at a time: a line's time is shared out by how long each word takes to say.
    const captions = timed.lines.flatMap((line) => {
      const parts = line.text.split(" ");
      const sum = parts.reduce((n, word) => n + sayLength(word), 0);
      let said = 0;
      return parts.map((word) => {
        const start = line.start + (said / sum) * line.frames;
        said += sayLength(word);
        return { word, start, end: line.start + line.frames + 8, who: line.who };
      });
    });
    return { ...timed, plan: direct(episode, timed.lines), words: captions };
  }, [episode, clips]);

  const cut = last(plan.cuts.filter((c) => frame >= c.at)) ?? plan.cuts[0];
  const since = frame - cut.at;
  const shout = cut.shot === "devTight" || cut.shot === "high" ? 1 : 0;

  // Each cut lands with a small push-in, then the camera keeps creeping and swaying.
  const cam = CAMS[cut.shot];
  const pull =
    1 + 0.07 * (1 - enter(frame, cut.at, 8)) - Math.min(0.05, since * 0.0005);
  const camera = new PerspectiveCamera(FOV, width / height, 0.1, 100);
  camera.position.set(
    cam.target[0] +
      (cam.pos[0] - cam.target[0]) * pull +
      Math.sin(frame / 37) * 0.025 +
      (cut.shot === "wide" ? Math.sin(since / 60) * 0.4 : 0) +
      Math.sin(frame * 2.3) * shout * 0.025,
    cam.target[1] +
      (cam.pos[1] - cam.target[1]) * pull +
      Math.cos(frame / 51) * 0.02 +
      Math.cos(frame * 2.9) * shout * 0.025,
    cam.target[2] + (cam.pos[2] - cam.target[2]) * pull,
  );
  camera.lookAt(...cam.target);
  camera.updateMatrixWorld(true);

  const onScreen = (point: V3) => {
    const flat = new Vector3(...point).project(camera);
    return {
      x: (flat.x * 0.5 + 0.5) * width,
      y: (1 - (flat.y * 0.5 + 0.5)) * height,
    };
  };

  const talk = (who: string) => {
    const i = lines.findIndex(
      (l) => l.who === who && frame >= l.start && frame < l.start + l.frames,
    );
    if (i < 0) return 0;
    const data = clips[i]?.lips ?? [];
    const at = frame - lines[i].start;
    return ((data[at] ?? 0) + (data[at - 1] ?? 0)) / 2;
  };

  // The wall screen's rectangle on the video frame, for the words drawn on it.
  const topLeft = onScreen([
    WALL_SCREEN.x - WALL_SCREEN.w / 2,
    WALL_SCREEN.y + WALL_SCREEN.h / 2,
    WALL_SCREEN.z,
  ]);
  const bottomRight = onScreen([
    WALL_SCREEN.x + WALL_SCREEN.w / 2,
    WALL_SCREEN.y - WALL_SCREEN.h / 2,
    WALL_SCREEN.z,
  ]);
  const box = {
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
  const wall = last(plan.screen.filter((s) => frame >= s.at)) ?? {
    at: 0,
    state: "code" as const,
  };
  // In a close-up the screen sits behind a head, so its words are only drawn in the open shots.
  const wallInView = ["screen", "wide", "high"].includes(cut.shot);
  const word = last(words.filter((w) => frame >= w.start));

  const slide = episode.hook === "skid" ? 2.4 * (1 - enter(frame, 0, 14)) : 0;
  const big = 1 - enter(frame, 42, 14);
  const left = Math.max(
    0,
    (episode.countdown?.seconds ?? 0) - Math.floor(frame / 30),
  );
  const clock = `${Math.floor(left / 60)}:${left % 60 < 10 ? "0" : ""}${left % 60}`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1d1936", fontFamily, color: INK }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ fov: FOV, position: [0, 0, 0], near: 0.1, far: 100 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Studio
          view={camera.matrixWorldInverse.clone()}
          frame={frame}
          screen={wall.state}
          bars={wall.state === "code" && !wall.lines}
        >
          {cut.shot === "screen" ? null : (
            <>
              <Dev3D
                pose={poseAt(plan.dev, frame)}
                talk={talk("dev")}
                frame={frame}
                x={DEV_X - slide}
                z={STAND_Z}
                yaw={0.5}
              />
              <Bit3D
                pose={poseAt(plan.bot, frame)}
                talk={talk("bot")}
                frame={frame}
                x={BOT_X}
                y={TABLE.top}
                z={BOT_Z}
                yaw={-0.5}
              />
            </>
          )}
        </Studio>
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 48%, rgb(12 8 34 / 0.6) 100%)",
        }}
      />

      {wall.lines && wallInView ? (
        <div
          style={{
            position: "absolute",
            ...box,
            display: "flex",
            flexDirection: "column",
            alignItems: wall.state === "diff" ? "stretch" : "center",
            justifyContent: "center",
            gap: box.width * (wall.state === "diff" ? 0.012 : 0.03),
            padding: wall.state === "diff" ? box.width * 0.04 : 0,
            boxSizing: "border-box",
            fontFamily: mono,
            fontWeight: 700,
            textAlign: wall.state === "diff" ? "left" : "center",
            lineHeight: 1.1,
            color: "#ffffff",
            opacity:
              enter(frame, wall.at, 4) *
              (wall.blink ? 0.55 + 0.45 * Math.abs(Math.sin(frame / 4)) : 1),
          }}
        >
          {wall.lines.map((text, i) =>
            wall.state === "diff" ? (
              // A diff: removed lines red, added lines green, as in a pull request.
              <div
                key={`${i} ${text}`}
                style={{
                  fontSize: box.width * 0.047,
                  whiteSpace: "pre",
                  padding: `${box.width * 0.008}px ${box.width * 0.015}px`,
                  borderRadius: box.width * 0.01,
                  color: text.startsWith("+")
                    ? "#86efac"
                    : text.startsWith("-")
                      ? "#fca5a5"
                      : "#cbd5e1",
                  backgroundColor: text.startsWith("+")
                    ? "rgb(34 197 94 / 0.16)"
                    : text.startsWith("-")
                      ? "rgb(239 68 68 / 0.16)"
                      : undefined,
                }}
              >
                {text}
              </div>
            ) : (
              <div
                key={`${i} ${text}`}
                style={{
                  fontSize: box.width * (i === 0 ? 0.085 : 0.058),
                  color: i === 0 ? SCREEN_INK[wall.state] : undefined,
                }}
              >
                {text}
              </div>
            ),
          )}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
        }}
      >
        {episode.badge ? (
          <div style={{ ...chip, fontSize: 40, border: "4px solid #35c9a5" }}>
            {episode.badge}
          </div>
        ) : null}
        {episode.countdown ? (
          <div
            style={{
              ...chip,
              fontSize: 54,
              border: "5px solid #ff4d5e",
              marginTop: 150 * big,
              scale: 1 + 0.75 * big,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                backgroundColor: "#ff4d5e",
                opacity: frame % 30 < 15 ? 1 : 0.25,
              }}
            />
            {episode.countdown.label} {clock}
          </div>
        ) : null}
      </div>

      {episode.endCard && frame >= total - 50 ? (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            top: 1090,
            display: "flex",
            justifyContent: "center",
            opacity: enter(frame, total - 50, 8),
          }}
        >
          <div
            style={{
              ...chip,
              display: "block",
              textAlign: "center",
              lineHeight: 1.15,
              fontFamily,
              fontSize: 66,
              fontWeight: 800,
            }}
          >
            {episode.endCard}
          </div>
        </div>
      ) : null}

      {word && frame < word.end ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1300,
            textAlign: "center",
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 1,
            color: word.who === "bot" ? "#a7f3e0" : "#ffffff",
            WebkitTextStroke: `16px ${INK}`,
            paintOrder: "stroke fill",
            scale: 0.86 + enter(frame, word.start, 4) * 0.14,
          }}
        >
          {word.word}
        </div>
      ) : null}

      {lines.map((line, i) => (
        <Audio
          key={line.start}
          name={`Line ${i + 1}`}
          src={staticFile(`voice/${clips[i].file}`)}
          from={line.start}
          volume={0.9}
        />
      ))}
      {plan.sounds.map((sound) => (
        <Audio
          key={`${sound.name} ${sound.at}`}
          name={`Sound ${sound.name}`}
          src={staticFile(`sfx/${sound.name}.wav`)}
          from={sound.at}
          durationInFrames={sound.frames}
          volume={sound.volume ?? 0.5}
        />
      ))}
      {episode.music === false || lines.length === 0 ? null : (
        <Audio name="Music" src={staticFile("music/loop.wav")} loop volume={0.1} />
      )}
    </AbsoluteFill>
  );
};
