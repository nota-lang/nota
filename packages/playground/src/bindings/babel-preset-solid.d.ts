/** Local types for the untyped Babel preset; only used options are named. */
declare module "babel-preset-solid" {
  export interface SolidPresetOptions {
    /** Codegen target. Defaults to `"dom"`. */
    generate?: "dom" | "ssr";
    /** Emit hydration markers and ids. Unset (falsy) by default. */
    hydratable?: boolean;
    /** Specifier the emitted runtime imports come from. Defaults to `"@solidjs/web"`. */
    moduleName?: string;
    [option: string]: unknown;
  }
  const preset: (
    api: unknown,
    options?: SolidPresetOptions
  ) => { plugins: unknown[] };
  export default preset;
}
