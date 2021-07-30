import React, { useState, useContext, useEffect, forwardRef } from "react";
import _ from "lodash";
import { createPopper, Instance } from "@popperjs/core";
import classNames from "classnames";
import { makeObservable, observable, action } from "mobx";
import { observer } from "mobx-react";

import { ToplevelElem } from "./document";
import { AdaptiveDisplay, HTMLAttributes } from "./utils";
import { scroll_to } from "./scroll";

export interface DefinitionData {
  Tooltip: React.FC | null;
  Label: React.FC | null;
}

export class AllDefinitionData {
  @observable defs: { [name: string]: DefinitionData } = {};
  @observable def_mode: boolean = false;
  // @observable second_pass: boolean = false;

  constructor() {
    makeObservable(this);
  }

  get_definition = (name: string): DefinitionData | undefined => this.defs[name];

  add_definition = action((name: string, def: DefinitionData) => {
    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
  });

  add_mode_listeners() {
    let on_keydown = action(({ key }: KeyboardEvent) => {
      if (key === "Alt") {
        this.def_mode = true;
      }
    });

    let on_keyup = action(({ key }: KeyboardEvent) => {
      if (key == "Alt") {
        this.def_mode = false;
      }
    });

    useEffect(() => {
      window.addEventListener("keydown", on_keydown);
      window.addEventListener("keyup", on_keyup);
      return () => {
        window.removeEventListener("keydown", on_keydown);
        window.removeEventListener("keyup", on_keyup);
      };
    }, []);
  }
}

export let DefinitionContext = React.createContext<AllDefinitionData>(new AllDefinitionData());

interface DefinitionProps {
  name?: string;
  block?: boolean;
  Tooltip?: React.FC | null;
  Label?: React.FC;
}

export let DefinitionAnchor: React.FC<{ name: string; block?: boolean }> = props => (
  <AdaptiveDisplay block={props.block} id={`def-${props.name}`}>
    {props.children}
  </AdaptiveDisplay>
);

export let Definition: React.FC<DefinitionProps> = props => {
  let ctx = useContext(DefinitionContext);
  let [name] = useState(props.name || _.uniqueId("def-"));

  useEffect(() => {
    let Tooltip =
      typeof props.Tooltip !== "undefined" ? props.Tooltip : () => <>{props.children}</>;
    let Label = props.Label || null;
    ctx.add_definition(name, { Tooltip, Label });
  }, []);

  return (
    <DefinitionAnchor block={props.block} name={name}>
      {props.children}
    </DefinitionAnchor>
  );
};

interface RefProps {
  name: string;
  block?: boolean;
  nolink?: boolean;
}

interface TooltipProps {
  Inner: React.FC<HTMLAttributes & { ref: any }>;
  Popup: React.FC;
}

// TODO
// * Immediately:
//   - wrap this logic into a context
//   - document weird state machine bits about flushing / being in an event
// * Long term:
//   - better architecture for this??
let elts: any = {};
let queue: string[] = [];
let flushed = false;
let in_event = false;
let queue_update = (id: string) => {
  // console.log("queueing", id);
  queue.push(id);
};

let check_queue = () => {
  if (!_.every(queue, id => id in elts)) {
    return;
  }

  let last_el: Element | null = null;
  queue.forEach(id => {
    let { popperElement, referenceElement, instance, set_show } = elts[id];
    let ref_el = last_el === null ? referenceElement : last_el;
    instance.state.elements.reference = ref_el;
    instance.forceUpdate();
    set_show(true);
    last_el = popperElement;
  });

  Object.keys(elts).forEach(id => {
    if (queue.indexOf(id) == -1) {
      elts[id].set_show(false);
    }
  });

  queue = [];
  if (in_event) {
    flushed = true;
  }
};

window.addEventListener(
  "click",
  () => {
    in_event = true;
  },
  true
);

window.addEventListener("click", () => {
  if (!flushed) {
    check_queue();
  }

  flushed = false;
  in_event = false;
});

let Tooltip = observer(({ Inner, Popup }: TooltipProps) => {
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);
  const [instance, set_instance] = useState<Instance | null>(null);

  let [id] = useState(_.uniqueId());
  let [stage, set_stage] = useState("start");
  let [show, set_show] = useState(false);

  let trigger = () => {
    if (stage == "start") {
      set_stage("mount");
    }
    queue_update(id);
  };

  useEffect(() => {
    if (stage == "mount" && referenceElement && popperElement) {
      set_stage("done");
      let instance = createPopper(referenceElement, popperElement, {
        placement: "top",
        modifiers: [
          // Push tooltip farther away from content
          { name: "offset", options: { offset: [0, 10] } },

          // Add arrow
          { name: "arrow", options: { element: arrowElement } },
        ],
      });
      set_instance(instance);
      elts[id] = {
        popperElement,
        referenceElement,
        instance,
        set_show,
      };
      check_queue();
    }
  }, [stage, referenceElement, popperElement]);

  return (
    <>
      <Inner ref={setReferenceElement} onClick={trigger} />
      {stage != "start" ? (
        <ToplevelElem>
          <div
            className="tooltip"
            ref={setPopperElement}
            style={
              {
                ...(stage == "done" ? instance!.state.styles.popper : {}),
                // Have to use visibility instead of display so tooltips can
                // correctly compute position for stacking
                visibility: show ? "visible" : "hidden",
              } as any
            }
            {...(stage == "done" ? instance!.state.attributes.popper : {})}
          >
            <div
              className="arrow"
              ref={setArrowElement}
              style={{
                // Can't use visibility here b/c it messes with the special CSS for arrows
                display: show ? "block" : "none",
              }}
            />
            <Popup />
          </div>
        </ToplevelElem>
      ) : null}
    </>
  );
});

export let Ref: React.FC<RefProps> = observer(props => {
  let ctx = useContext(DefinitionContext);
  let def = ctx.get_definition(props.name);
  if (!def) {
    return <span className="error">{props.name}</span>;
  }

  let on_click: React.MouseEventHandler = e => {
    e.preventDefault();
    e.stopPropagation();

    scroll_to(`def-${props.name}`);
  };

  let inner: JSX.Element = props.children ? (
    <>{props.children}</>
  ) : def.Label ? (
    <def.Label />
  ) : (
    <span className="error">No children or label for "{props.name}"</span>
  );

  let scroll_event = def.Tooltip ? "onDoubleClick" : "onClick";
  let event_props = { [scroll_event]: on_click };

  let Inner = forwardRef<HTMLDivElement>((inner_props, ref) => (
    <AdaptiveDisplay
      ref={ref}
      block={props.block}
      className={classNames("ref", {
        nolink: props.nolink,
      })}
      {...inner_props}
      {...event_props}
    >
      {inner}
    </AdaptiveDisplay>
  ));

  if (def.Tooltip) {
    return <Tooltip Inner={Inner} Popup={def.Tooltip} />;
  } else {
    return <Inner />;
  }
});
