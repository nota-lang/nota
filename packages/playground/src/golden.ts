/**
 * The pane **parity-test fixture**: `integration/golden.nota` (the Colorized island example, the
 * project's end-to-end golden). The editor seeds from {@link DEFAULT_SNIPPET}, not this — the seed
 * is a first-contact tour, the golden a parity fixture (see default-snippet.ts). Kept inline
 * (rather than a `?raw` import across the package boundary) so the tests don't depend on Vite's
 * `fs.allow`. If `integration/golden.nota` changes, update this to match (the parity tests compile
 * both through the same compiler, so drift surfaces as a test diff).
 */
export const GOLDEN_NOTA = `%let Colorized = inlineComponent((children) => {
  let [color, setColor] = useState("red");
  return @span[onClick: () => setColor("green")][style: {color}]{@children};
})

@for (x of ["a", "b"]) {
  - @Colorized{@x}
}
`;
