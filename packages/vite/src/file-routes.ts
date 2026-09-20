/**
 * `.nota` documents as file-system routes. The scanner reads raw files, so documents
 * declare their default component by extension; ordinary modules keep the built-in
 * export analysis. Order this plugin after `notaStart()` so route transforms see JS.
 * `filesystem-routing` is an optional peer, imported only by this subpath.
 */
import { PageFileSystemRouter } from "filesystem-routing";
import {
  DEFAULT_EXTENSIONS as DEFAULT_ROUTE_EXTENSIONS,
  type FileRoutesOptions,
  fileRoutes
} from "filesystem-routing/vite";
import type { PluginOption } from "vite";
import { DEFAULT_EXTENSIONS } from "./lib.js";

/** The default JavaScript route extensions plus Nota document extensions. */
export const DEFAULT_NOTA_ROUTE_EXTENSIONS: readonly string[] = [
  ...DEFAULT_ROUTE_EXTENSIONS,
  ...DEFAULT_EXTENSIONS.map(ext => ext.replace(/^\./, ""))
];

/**
 * Configure the standard delivery plugin with Nota's module convention. The base
 * plugin owns root-relative directories, scanning, environments and delivery.
 * Explicit routers and `toRoute` callbacks retain their usual precedence.
 */
export function notaFileRoutes(
  options: FileRoutesOptions = {}
): PluginOption[] {
  return fileRoutes({
    ...options,
    extensions: options.extensions ?? [...DEFAULT_NOTA_ROUTE_EXTENSIONS],
    toRoute:
      options.toRoute ??
      ((src, router) => {
        if (!DEFAULT_EXTENSIONS.some(ext => src.endsWith(ext))) {
          // Clear our callback when delegating to avoid recursively invoking it.
          return new PageFileSystemRouter({
            ...router.config,
            toRoute: undefined
          }).toRoute(src);
        }
        const path = router.toPath(src);
        if (path === undefined) return;
        return {
          page: true,
          path,
          $component:
            options.components !== false
              ? { src, pick: ["default", "$css"] }
              : undefined,
          $$route: undefined
        };
      })
  });
}

export default notaFileRoutes;
