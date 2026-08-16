import { nota } from "@nota-lang/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [nota()],
  test: {
    environment: "jsdom",
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  }
}));
