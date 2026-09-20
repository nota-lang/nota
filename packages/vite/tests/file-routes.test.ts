import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PageFileSystemRouter } from "filesystem-routing";
import type { FileRoutesOptions } from "filesystem-routing/vite";
import { createServer } from "vite";
import { describe, expect, test } from "vitest";
import { notaFileRoutes } from "../src/file-routes";

const root = fileURLToPath(new URL("./fixtures/start-site", import.meta.url));

async function manifest(options: FileRoutesOptions = {}) {
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "error",
    plugins: notaFileRoutes(options),
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true }
  });
  try {
    const loaded = await server.ssrLoadModule("virtual:file-routes");
    return loaded.default as {
      path: string;
      page?: boolean;
      $component?: { src: string };
    }[];
  } finally {
    await server.close();
  }
}

describe("notaFileRoutes", () => {
  test("finds documents and JS pages relative to the Vite root", async () => {
    const routes = await manifest();
    expect(routes.map(route => route.path).sort()).toEqual([
      "/",
      "/doc",
      "/hidden"
    ]);
    expect(routes.find(route => route.path === "/doc")).toMatchObject({
      page: true,
      $component: { src: expect.stringMatching(/doc\.nota(?:\?|$)/) }
    });
    expect(routes.find(route => route.path === "/")?.page).toBe(true);
  });

  test("respects explicit extensions and a root-relative directory", async () => {
    const routes = await manifest({ dir: "src/routes", extensions: ["nota"] });
    expect(routes.map(route => route.path)).toEqual(["/doc"]);
  });

  test("components: false omits both document and JS components", async () => {
    const routes = await manifest({ components: false });
    expect(routes).toHaveLength(3);
    expect(routes.every(route => route.page && !route.$component)).toBe(true);
  });

  test("uses custom paths for both documents and JS modules", async () => {
    const routes = await manifest({ toPath: path => `/custom${path}` });
    expect(routes.map(route => route.path).sort()).toEqual([
      "/custom/doc",
      "/custom/hidden",
      "/custom/index"
    ]);
  });

  test("allows the path convention to exclude documents", async () => {
    const routes = await manifest({ toPath: () => undefined });
    expect(routes).toEqual([]);
  });

  test("an explicit module convention replaces the Nota convention", async () => {
    const routes = await manifest({ toRoute: () => undefined });
    expect(routes).toEqual([]);
  });

  test("an explicit router retains its own convention", async () => {
    const routes = await manifest({
      router: new PageFileSystemRouter({
        dir: join(root, "src/routes"),
        extensions: ["tsx"]
      })
    });
    expect(routes.map(route => route.path).sort()).toEqual(["/", "/hidden"]);
  });
});
