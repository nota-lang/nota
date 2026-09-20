/** Render a self-hosted document as a full page for the hydration suite. */
import { renderToString } from "@solidjs/web";
import { Hydration, NoHydration } from "solid-js";
import { Doc } from "./hydrate-doc";

export function run(): { page: string } {
  const page = renderToString(() => (
    <NoHydration>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <div id="app">
            <Hydration>
              <Doc />
            </Hydration>
          </div>
        </body>
      </html>
    </NoHydration>
  ));
  return { page };
}
