// The wasm reader is built out-of-tree (`just nota-build` in oxc/, wasm-bindgen --target bundler).
// Vendor it into src/ so it ships in this package's dist/ — depot copies `.wasm` as an asset.
import { cpSync } from "node:fs";

cpSync("../../oxc/target/js", "src/generated", { recursive: true });
