import React, { useState, useContext, useEffect } from "react";
import _ from "lodash";
import RcTooltip from "rc-tooltip";
import classNames from "classnames";
import { makeObservable, when, observable, action } from "mobx";
import { observer } from "mobx-react";

import { AdaptiveDisplay } from "./utils";

interface Definition {
  Tooltip: React.FC | null;
  Label: React.FC | null;
}

export class DefinitionData {
  @observable defs: { [name: string]: Definition } = {};
  @observable def_mode: boolean = false;
  // @observable second_pass: boolean = false;

  constructor() {
    makeObservable(this);
  }

  add_definition(name: string, def: Definition) {
    if (!(name in this.defs)) {
      action(() => {
        this.defs[name] = def;
      })();
    }
  }

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

export let DefinitionContext = React.createContext<DefinitionData>(
  new DefinitionData()
);

interface DefinitionProps {
  name?: string;
  block?: boolean;
  Tooltip?: React.FC | null;
  Label?: React.FC;
}

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
    <AdaptiveDisplay block={props.block} id={`def-${name}`}>
      {props.children}
    </AdaptiveDisplay>
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

export let Ref: React.FC<RefProps> = observer((props) => {
  let ctx = useContext(DefinitionContext);
  let def = ctx.defs[props.name];
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

  inner = (
    <AdaptiveDisplay
      block={props.block}
      className={classNames("ref", {
        nolink: props.nolink,
        "def-mode": ctx.def_mode,
      })}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onDoubleClick={on_click}
    >
      {inner}
    </AdaptiveDisplay>
  );

  if (def.Tooltip) {
    return (
      <RcTooltip placement="top" overlay={<def.Tooltip />} trigger={["click"]}>
        {inner}
      </RcTooltip>
    );
  } else {
    return inner;
  }
});
