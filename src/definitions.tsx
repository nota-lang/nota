import React, {
  useState,
  useContext,
  useEffect,
  forwardRef,
  useLayoutEffect,
} from "react";
import _ from "lodash";
import ReactDOM from "react-dom";
// import { usePopper } from "react-popper";
import { createPopper, Instance  } from "@popperjs/core";
import classNames from "classnames";
import { autorun, makeObservable, observable, action, runInAction } from "mobx";
import { observer, useLocalObservable } from "mobx-react";

import { ToplevelElem } from "./document";
import { AdaptiveDisplay, HTMLAttributes } from "./utils";
import { useRef } from "react";
import { end } from "@popperjs/core";

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

  get_definition = (name: string): DefinitionData | undefined =>
    this.defs[name];

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

export let DefinitionContext = React.createContext<AllDefinitionData>(
  new AllDefinitionData()
);

interface DefinitionProps {
  name?: string;
  block?: boolean;
  Tooltip?: React.FC | null;
  Label?: React.FC;
}

export let DefinitionAnchor: React.FC<{ name: string; block?: boolean }> = (
  props
) => (
  <AdaptiveDisplay block={props.block} id={`def-${props.name}`}>
    {props.children}
  </AdaptiveDisplay>
);

export let Definition: React.FC<DefinitionProps> = (props) => {
  let ctx = useContext(DefinitionContext);
  let [name] = useState(props.name || _.uniqueId("def-"));

  useEffect(() => {
    let Tooltip =
      typeof props.Tooltip !== "undefined"
        ? props.Tooltip
        : () => <>{props.children}</>;
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

// https://stackoverflow.com/questions/5353934/check-if-element-is-visible-on-screen
function checkVisible(elm: any): boolean {
  var rect = elm.getBoundingClientRect();
  var viewHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight
  );
  return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
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
  console.log('queueing', id);
  queue.push(id);
};

let check_queue = () => {
  if (!_.every(queue, (id) => id in elts)) {
    return;
  }

  console.log('flushing', queue);
  let last_el: Element | null = null;
  queue.forEach((id) => {
    let { popperElement, referenceElement, instance, set_show } =
      elts[id];
    let ref_el = last_el === null ? referenceElement : last_el;
    instance.state.elements.reference = ref_el;
    instance.forceUpdate();
    set_show(true);
    last_el = popperElement;
  });

  Object.keys(elts).forEach((id) => {
    if (queue.indexOf(id) == -1) {
      elts[id].set_show(false);
    }
  });

  queue = [];
  if (in_event) {
    flushed = true;
  }
};

window.addEventListener("click", () => {
  in_event = true;
}, true);

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
  const [instance, set_instance] = useState<Instance | null>(null);

  let def_ctx = useContext(DefinitionContext);

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
        modifiers: [{ name: "offset", options: { offset: [0, 10] } }],
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
            style={{
              ...(stage == "done" ? instance!.state.styles.popper : {}),
              visibility: show ? "visible" : "hidden",
            } as any}
            {...(stage == "done" ? instance!.state.attributes.popper : {})}
          >
            <Popup />
          </div>
        </ToplevelElem>
      ) : null}
    </>
  );
});

export let Ref: React.FC<RefProps> = observer((props) => {
  let ctx = useContext(DefinitionContext);
  let def = ctx.get_definition(props.name);
  if (!def) {
    return <span className="error">{props.name}</span>;
  }

  let on_click: React.MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    let anchor_id = `def-${props.name}`;
    let anchor_elem = document.getElementById(anchor_id)!;
    let anchor_hash = "#" + anchor_id;

    if (window.location.hash == anchor_hash) {
      // TODO: figure out how to make :target re-trigger in this instance
    }

    window.history.pushState(null, "", anchor_hash);

    // Hack to trigger :target
    // See: https://github.com/whatwg/html/issues/639
    window.history.pushState(null, "", "#" + anchor_hash);
    window.history.back();

    // Don't scroll if element is visible
    // See: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
    if (checkVisible(anchor_elem)) {
      return;
    }

    // Effect doesn't seem to trigger immediately after history.back()?
    // TODO: bad workaround
    setTimeout(() => {
      let block: ScrollLogicalPosition =
        anchor_elem!.offsetHeight > window.innerHeight ? "start" : "center";
      anchor_elem!.scrollIntoView({
        // behavior: "smooth",
        block,
        inline: "center",
      });
    }, 100);
  };

  let inner: JSX.Element = props.children ? (
    <>{props.children}</>
  ) : def.Label ? (
    <def.Label />
  ) : (
    <span className="error">No children or label for "{props.name}"</span>
  );

  let Inner = forwardRef<HTMLDivElement>((inner_props, ref) => (
    <AdaptiveDisplay
      ref={ref}
      block={props.block}
      className={classNames("ref", {
        nolink: props.nolink,
      })}
      {...inner_props}
      onDoubleClick={on_click}
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
