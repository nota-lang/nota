/**
 * Reactive input affordances for explorable explanations.
 *
 * The binding convention is a plain prop pair — `value` (read; reactive like any Solid prop)
 * and `set` (write) — so a document binds a control to whatever state it owns:
 *
 * ```
 * % const S = createMutable({ theta: 0 });
 * @Slider[value: S.theta, set: v => S.theta = v, min: 0, max: 2, step: 0.1, label: "Theta"]
 * ```
 *
 * There is no name-based magic (`bind=theta`): the getter/setter pair is the whole protocol,
 * and any state container that can produce one participates.
 */

import { type JSX, type ParentProps, Show } from "solid-js";

/** Props for {@link Slider}. */
export interface SliderProps {
  /** Current value (reactive — the control follows outside writes to the same state). */
  value: number;
  /** Write the new value on user input. */
  set: (value: number) => void;
  /** Range minimum (default 0). */
  min?: number;
  /** Range maximum (default 100). */
  max?: number;
  /** Range step (default 1). */
  step?: number;
  /** Optional label, rendered before the track (markup allowed). */
  label?: JSX.Element;
  /** Format the value readout (default `String`); `false` hides the readout. */
  format?: ((value: number) => string) | false;
}

/**
 * A labeled range input: `<label><span>label</span><input type=range/><output/></label>`.
 * Controlled both ways — dragging calls `set`, and outside writes move the thumb.
 */
export function Slider(props: SliderProps): JSX.Element {
  return (
    <label class="nota-slider">
      <Show when={props.label !== undefined}>
        <span class="nota-slider-label">{props.label}</span>
      </Show>
      <input
        type="range"
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        value={props.value}
        onInput={e => props.set(Number(e.currentTarget.value))}
      />
      <Show when={props.format !== false}>
        <output class="nota-slider-value">
          {(props.format === false ? String : (props.format ?? String))(
            props.value
          )}
        </output>
      </Show>
    </label>
  );
}

/**
 * An action link: inline prose that performs a state change when activated —
 * `@Action[do: () => S.step = 2]{insert the first point}`. Renders a real `<button>`
 * (keyboard-activatable, no page jump) styled as link-like prose by `explorable.css`.
 */
export function Action(props: ParentProps & { do: () => void }): JSX.Element {
  return (
    <button type="button" class="nota-action" onClick={() => props.do()}>
      {props.children}
    </button>
  );
}
