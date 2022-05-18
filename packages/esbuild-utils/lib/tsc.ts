import * as cp from "child_process";
import { Plugin } from "esbuild";

// Detects ANSI codes in a string. Taken from https://github.com/chalk/ansi-regex
const ANSI_REGEX = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|"),
  "g"
);

/** Discount clone of Estrella. Runs tsc as a part of building. */
export let tscPlugin = (): Plugin => ({
  name: "tsc",
  setup(build) {
    let opts = ["-emitDeclarationOnly"];
    if (build.initialOptions.watch) {
      opts.push("-w");
    }

    let tsc = cp.spawn("tsc", opts);
    tsc.stdout!.on("data", data => {
      // Get rid of ANSI codes so the terminal isn't randomly cleared by tsc's output.
      console.log(data.toString().replace(ANSI_REGEX, "").trim());
    });
  },
});
