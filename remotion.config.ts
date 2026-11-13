import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Needed to render three.js scenes.
Config.setChromiumOpenGlRenderer("angle");
