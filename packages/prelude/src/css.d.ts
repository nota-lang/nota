/**
 * Stylesheet imports are side-effect-only: the bundler turns `import "./figure.css"` into a
 * stylesheet on the page, and the module has no value surface. tsc has no built-in notion of
 * this, so declare it.
 */
declare module "*.css";
