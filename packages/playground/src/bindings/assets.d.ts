// Vite asset query imports used by the playground.
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
declare module "*?raw" {
  const content: string;
  export default content;
}
declare module "*.css";
