// SSR build step for the client suite: load tests/fixtures/ssr-entry.tsx through Vite's SSR
// pipeline (vite-plugin-solid with ssr: true compiles JSX with generate:"ssr" + hydration keys)
// and write the rendered page to tests/.built/.
//
// Deliberately NOT the package vitest config: the dom project compiles JSX for the client, and
// one project can only compile one flavor.
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
  // @nota-lang/core ships JSX-preserved dist — it must ride through the plugin pipeline
  // (Node cannot execute raw JSX).
  ssr: { noExternal: [/^@nota-lang\//] },
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  let mod;
  if (typeof server.ssrLoadModule === "function") {
    mod = await server.ssrLoadModule("/tests/fixtures/ssr-entry.tsx");
  } else {
    const { createServerModuleRunner } = await import("vite");
    const runner = createServerModuleRunner(server.environments.ssr);
    mod = await runner.import("/tests/fixtures/ssr-entry.tsx");
  }
  const { app, shell } = mod.run();
  mkdirSync(join(pkgRoot, "tests/.built"), { recursive: true });
  // The page as the browser receives it: the app subtree in its mount point, the shell's
  // doc-state script after it (outside the hydrated region — the client reads it, never claims it).
  writeFileSync(
    join(pkgRoot, "tests/.built/page.html"),
    `<div id="app">${app}</div>${shell}`
  );
  console.log("wrote tests/.built/page.html");
} finally {
  await server.close();
}
