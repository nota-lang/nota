/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    environment: "node",
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  },
  resolve: { conditions: ["node"] }
}));
