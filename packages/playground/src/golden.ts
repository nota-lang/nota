/**
 * The pipeline **e2e fixture**: `integration/golden.nota` (the Colorized example, the project's
 * end-to-end golden). The editor seeds from {@link DEFAULT_SNIPPET}, not this — the seed is a
 * first-contact tour, the golden a parity fixture. Kept inline (rather than a `?raw` import
 * across the package boundary) so the tests don't depend on Vite's `fs.allow`. If
 * `integration/golden.nota` changes, update this to match.
 */
export const GOLDEN_NOTA = `%let Colorized = (props: { children?: unknown }) => {
  let [color, setColor] = createSignal("red");
  return @span[onClick: () => setColor("green")][style: {color: color()}]{@(props.children)};
}

@for (x of ["a", "b"]) {
  - @Colorized{@x}
}
`;
