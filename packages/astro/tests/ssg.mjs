// SSG build step for the client-entry suite: load tests/fixtures/ssg-entry.tsx through Vite's
// SSR pipeline (vite-plugin-solid with ssr: true compiles JSX with generate: "ssr" + hydration
// keys) and write the rendered island HTML + doc-state snapshot to tests/.built/.
//
// Deliberately NOT the package vitest config: the SSG pass is its own build target (the dom
// project compiles JSX for the client; one project can only compile one flavor).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import solid from "vite-plugin-solid";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));

const server = await createServer({
  configFile: false,
  root: pkgRoot,
  plugins: [solid({ ssr: true, solid: { hydratable: true } })],
  // The @nota-lang packages ship JSX-preserved dist — they must ride through the plugin
  // pipeline (Node cannot execute raw JSX), exactly like the integration's ssr.noExternal.
  ssr: { noExternal: [/^@nota-lang\//] },
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  let mod;
  if (typeof server.ssrLoadModule === "function") {
    mod = await server.ssrLoadModule("/tests/fixtures/ssg-entry.tsx");
  } else {
    // Vite environment-API fallback
    const { createServerModuleRunner } = await import("vite");
    const runner = createServerModuleRunner(server.environments.ssr);
    mod = await runner.import("/tests/fixtures/ssg-entry.tsx");
  }
  const { html, state } = mod.run();
  mkdirSync(join(pkgRoot, "tests/.built"), { recursive: true });
  writeFileSync(join(pkgRoot, "tests/.built/island.html"), html);
  writeFileSync(join(pkgRoot, "tests/.built/state.json"), state);
  console.log("wrote tests/.built/{island.html,state.json}");
} finally {
  await server.close();
}
