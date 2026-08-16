import { defineConfig } from "astro/config";
import nota from "../../../src/lib";

export default defineConfig({
  integrations: [nota()]
});
