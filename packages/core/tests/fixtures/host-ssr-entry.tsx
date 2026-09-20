/** Generate full-page SSR fixtures for self-hosted hydration tests. */
import type { JSX } from "@solidjs/web";
import { renderToString } from "@solidjs/web";
import { Hydration, NoHydration } from "solid-js";
import { Doc, Pair } from "./host-doc";

function page(app: () => JSX.Element): string {
  return renderToString(() => (
    <NoHydration>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <div id="app">
            <Hydration>{app()}</Hydration>
          </div>
        </body>
      </html>
    </NoHydration>
  ));
}

export function run(): { page: string; pairPage: string } {
  return { page: page(() => <Doc />), pairPage: page(() => <Pair />) };
}
