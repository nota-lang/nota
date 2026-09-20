// The router, file-system routed: every module under `src/routes/` with a default export is a
// page, and `notaFileRoutes()` adds `.nota` documents to that set without them needing a TSX
// wrapper (`routes/doc.nota` -> `/doc`). `pageRoutes` is the nested view of the manifest the
// plugin serves from `virtual:file-routes`.
import { pageRoutes } from "virtual:file-routes";
import { createRouter } from "@solidjs/router";
import { fileRoutes } from "@solidjs/router/fs";

export const Router = createRouter({ routes: fileRoutes(pageRoutes) });
