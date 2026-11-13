import { Composition } from "remotion";
import { FPS, timeline } from "./director";
import { EpisodeVideo } from "./Episode";
import type { EpisodeProps } from "./types";

// One composition plays any episode: `shipskit render` passes the episode and its recordings
// as props, and the video is as long as the recordings make it.
const EMPTY: EpisodeProps = { episode: { title: "", lines: [] }, clips: [] };

export const Root = () => (
  <Composition
    id="Episode"
    component={EpisodeVideo}
    defaultProps={EMPTY}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={60}
    calculateMetadata={({ props }) => ({
      durationInFrames: timeline(
        props.episode,
        props.clips.map((clip) => clip.seconds),
      ).total,
    })}
  />
);
