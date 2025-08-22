import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_seihzkbiyhwdczasxagt",
  logLevel: "log",
  maxDuration: 300, // 5 minutes - enough time for API calls and processing
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});