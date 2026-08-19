/** Reactive controls used by the explorable document. */

import { type JSX, type ParentProps, Show } from "solid-js";

export interface SliderProps {
  value: number;
  set: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: JSX.Element;
  format?: ((value: number) => string) | false;
}

/** Controlled range input with an optional label and value formatter. */
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

/** A button styled as an inline prose action. */
export function Action(props: ParentProps & { do: () => void }): JSX.Element {
  return (
    <button type="button" class="nota-action" onClick={() => props.do()}>
      {props.children}
    </button>
  );
}
