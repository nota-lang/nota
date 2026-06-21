/**
 * The seed document for the editor: `integration/golden.nota` (the Colorized island example —
 * decode.md's worked example / the project's end-to-end golden). Kept inline (rather than a `?raw`
 * import across the package boundary) so the editor seed and the pane parity tests share one literal
 * without depending on Vite's `fs.allow`. If `integration/golden.nota` changes, update this to match
 * (the parity tests compile both through the same compiler, so drift surfaces as a test diff only if
 * the *expected* fixtures are regenerated — keep them identical).
 */
export const GOLDEN_NOTA = `%let Colorized = inlineComponent((children) => {
  let [color, setColor] = useState("red");
  return @span[onClick: () => setColor("green")][style: {color}]{@children};
})

@for (x of ["a", "b"]) {
  - @Colorized{@x}
}
`;
