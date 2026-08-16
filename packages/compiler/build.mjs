import {cpSync} from "node:fs";

cpSync("../../oxc/target/js", "src/generated", { recursive: true });