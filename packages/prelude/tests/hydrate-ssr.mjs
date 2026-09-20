// SSR build step for tests/hydrate.test.tsx: load tests/fixtures/hydrate-ssr-entry.tsx through
// Vite's SSR pipeline (@solidjs/vite-plugin with ssr: true compiles JSX with generate:"ssr" +
// hydration keys) and write the rendered page to tests/.built/.
//
// Deliberately NOT the package vitest config: the dom project compiles JSX for the client, and
// one project can only compile one flavor. Same shape as core's tests/host-ssr.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { createServer } from "vite";

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
    mod = await server.ssrLoadModule("/tests/fixtures/hydrate-ssr-entry.tsx");
  } else {
    const { createServerModuleRunner } = await import("vite");
    const runner = createServerModuleRunner(server.environments.ssr);
    mod = await runner.import("/tests/fixtures/hydrate-ssr-entry.tsx");
  }
  const { page } = mod.run();
  mkdirSync(join(pkgRoot, "tests/.built"), { recursive: true });
  // The page as the browser receives it: a whole document, doc-state script in <head>.
  writeFileSync(join(pkgRoot, "tests/.built/hydrate-page.html"), page);
  console.log("wrote tests/.built/hydrate-page.html");
} finally {
  await server.close();
}
