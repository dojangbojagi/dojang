import { Config } from "@remotion/cli/config";

/* GYEVO promotional videos (see remotion/README.md). The video workspace is self-contained:
   its own entry point and its own static directory, so nothing of the Next.js app is served or changed. */
Config.setEntryPoint("./remotion/index.ts");
Config.setPublicDir("./remotion/public");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setAudioCodec("aac");
Config.setAudioBitrate("320k");
Config.setOverwriteOutput(true);
