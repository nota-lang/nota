// tsc emits only what it compiles, so the stylesheets code.tsx/def.tsx/figure.tsx import are not
// in dist. Copy them across, preserving the relative specifier those modules use.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync("dist", { recursive: true });
for (const file of readdirSync("src").filter(f => f.endsWith(".css"))) {
  copyFileSync(join("src", file), join("dist", file));
}
