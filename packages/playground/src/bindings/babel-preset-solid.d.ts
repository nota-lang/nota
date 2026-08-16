/** babel-preset-solid ships no types; the preset object is opaque to us (babel consumes it). */
declare module "babel-preset-solid" {
  const preset: unknown;
  export default preset;
}
