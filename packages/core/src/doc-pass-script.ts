/** Consume a parked host pass, verify it, and serialize its hydration seed. */

import type { JSX } from "solid-js";
import { ssr } from "solid-js/web";
import { takeDocPass } from "./doc-pass";
import { assertDocStateConverged, docStateScript } from "./render";

/** Return the state script for `event`, or nothing when no Nota route parked a pass. */
export function takeDocPassScript(event: unknown): JSX.Element {
  const pass = takeDocPass(event);
  if (!pass) return null;
  const post = pass.state.snapshot();
  assertDocStateConverged(pass.seed, post, pass.passes);
  return ssr(docStateScript(pass.seed)) as unknown as JSX.Element;
}
