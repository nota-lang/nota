/**
 * `@nota-lang/explorable` — interaction primitives for explorable explanations
 * (after Idyll / Living Papers, specialized to Nota's Solid substrate).
 *
 * Everything here is a plain Solid component over an explicit getter/setter protocol; document
 * state is whatever the document declares (`createSignal`, `createMutable`, …) — the library
 * adds no state container, no name-based binding layer, and no runtime of its own.
 *
 * - {@link Slider} — a labeled range input bound through a `value`/`set` prop pair;
 * - {@link Action} — an inline prose control (`@Action[do: …]{…}`) that runs a thunk on click;
 * - {@link Sticky} — a sticky zero-height panel for keeping a figure in view.
 *
 * Ship the look with the package stylesheet: `import "@nota-lang/explorable/explorable.css"`.
 */

export { Action, Slider, type SliderProps } from "./inputs";
export { Sticky } from "./layout";
