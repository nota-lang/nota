import React, { useState, useContext, useEffect, forwardRef } from "react";
import _ from "lodash";
import { createPopper, Instance } from "@popperjs/core";
import classNames from "classnames";
import { makeObservable, observable, action } from "mobx";
import { observer } from "mobx-react";

import { ToplevelElem } from "./document";
import { Container, HTMLAttributes } from "./utils";
import { scroll_to } from "./scroll";

export interface DefinitionData {
  Tooltip: React.FC | null;
  Label: React.FC | null;
}

export class AllDefinitionData {
  @observable.shallow defs: { [name: string]: DefinitionData } = {};
  @observable def_mode: boolean = false;
  @observable used_definitions: Set<string> = new Set();

  constructor() {
    makeObservable(this);
  }

  register_use = action((name: string) => {
    this.used_definitions.add(name);
  })

  get_definition = (name: string): DefinitionData | undefined => {
    return this.defs[name];
  };

  add_definition = action((name: string, def: DefinitionData) => {
    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
  });

  add_listeners() {
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

let name_to_id = (name: string): string => `def-${name.replace(':', '-')}`;

export let DefinitionAnchor: React.FC<{ name: string; block?: boolean }> = props => (
  <Container block={props.block} id={name_to_id(props.name)}>
    {props.children}
  </Container>
);

export let Definition: React.FC<DefinitionProps> = props => {
  let ctx = useContext(DefinitionContext);
  let [name] = useState(props.name || _.uniqueId());

  useEffect(() => {
    let Tooltip =
      typeof props.Tooltip !== "undefined" ? props.Tooltip : () => <>{props.children}</>;
    let Label = props.Label || null;
    ctx.add_definition(name, { Tooltip, Label });
  }, []);

  return props.children ? (
    <DefinitionAnchor block={props.block} name={name}>
      {props.children}
    </DefinitionAnchor>
  ) : null;
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
//   - document weird state machine bits about flushing / being in an event
// * Long term:
//   - better architecture for this??

export class TooltipData {
  elts: any = {};
  queue: string[] = [];
  flushed = false;
  in_event = false;

  queue_update = (id: string) => {
    this.queue.push(id);
  };
  
  check_queue = () => {
    if (!_.every(this.queue, id => id in this.elts)) {
      return;
    }
  
    let last_el: Element | null = null;
    this.queue.forEach(id => {
      let { popperElement, referenceElement, instance, set_show } = this.elts[id];
      let ref_el = last_el === null ? referenceElement : last_el;
      instance.state.elements.reference = ref_el;
      instance.forceUpdate();
      set_show(true);
      last_el = popperElement;
    });
  
    Object.keys(this.elts).forEach(id => {
      if (this.queue.indexOf(id) == -1) {
        this.elts[id].set_show(false);
      }
    });
  
    this.queue = [];
    if (this.in_event) {
      this.flushed = true;
    }
  };

  on_click = () => {
    if (!this.flushed) {
      this.check_queue();
    }
  
    this.flushed = false;
    this.in_event = false;
  };

  on_click_capture = () => {
    this.in_event = true;
  }

  add_listeners = () => {  
    useEffect(() => {
      window.addEventListener("click", this.on_click);
      window.addEventListener("click", this.on_click_capture, true);
      return () => {
        window.removeEventListener("click", this.on_click);
        window.removeEventListener("click", this.on_click_capture, true);
      };
    }, []);
  }
}

export let TooltipContext = React.createContext<TooltipData>(new TooltipData());

let Tooltip = observer(({ Inner, Popup }: TooltipProps) => {
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);
  const [instance, set_instance] = useState<Instance | null>(null);

  let ctx = useContext(TooltipContext);
  let [id] = useState(_.uniqueId());
  let [stage, set_stage] = useState("start");
  let [show, set_show] = useState(false);

  let trigger = () => {
    if (stage == "start") {
      set_stage("mount");
    }
    ctx.queue_update(id);
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
      ctx.elts[id] = {
        popperElement,
        referenceElement,
        instance,
        set_show,
      };
      ctx.check_queue();
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
  useEffect(() => {
    ctx.register_use(props.name);
  }, []);
  
  let def = ctx.get_definition(props.name);  
  if (!def) {
    return <span className="error">{props.name}</span>;
  }

  let on_click: React.MouseEventHandler = e => {
    e.preventDefault();
    e.stopPropagation();

    scroll_to(name_to_id(props.name));
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
    <Container
      ref={ref}
      block={props.block}
      className={classNames("ref", {
        nolink: props.nolink,
      })}
      {...inner_props}
      {...event_props}
    >
      {inner}
    </Container>
  ));

  if (def.Tooltip) {
    return <Tooltip Inner={Inner} Popup={def.Tooltip} />;
  } else {
    return <Inner />;
  }
});
