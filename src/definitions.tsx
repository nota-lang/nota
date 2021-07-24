import React, { useState, useContext, useEffect } from "react";
import _ from "lodash";
import Tooltip from "rc-tooltip";
import classNames from "classnames";

interface Definition {
  tooltip: JSX.Element | null;
  label: JSX.Element | null;
}

export class DefinitionData {
  defs: { [name: string]: Definition } = {};

  add_definition(name: string, def: Definition) {
    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
  }
}

export let DefinitionContext = React.createContext<DefinitionData>(
  new DefinitionData()
);

interface DefinitionProps {
  name?: string;
  block?: boolean;
  tooltip?: JSX.Element | null;
  label?: JSX.Element;
}

export let AdaptiveDisplay: React.FC<
  { block?: boolean } & React.HTMLAttributes<HTMLElement>
> = ({ block, ...props }) => {
  if (block) {
    return <div {...props} />;
  } else {
    return <span {...props} />;
  }
};

export let Definition: React.FC<DefinitionProps> = (props) => {
  let ctx = useContext(DefinitionContext);
  let [name] = useState(props.name || _.uniqueId("def-"));

  useEffect(() => {
    let tooltip =
      typeof props.tooltip !== "undefined" ? (
        props.tooltip
      ) : (
        <>{props.children}</>
      );
    let label = props.label || null;
    ctx.add_definition(name, { tooltip, label });
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

export let Ref: React.FC<RefProps> = (props) => {
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
  ) : def.label ? (
    def.label
  ) : (
    <span className="error">No children or label for "{props.name}"</span>
  );

  inner = (
    <AdaptiveDisplay
      block={props.block}
      className={classNames("ref", { nolink: props.nolink })}
      onClick={on_click}
    >
      {inner}
    </AdaptiveDisplay>
  );

  if (def.tooltip) {
    return (
      <Tooltip placement="top" overlay={def.tooltip}>
        {inner}
      </Tooltip>
    );
  } else {
    return inner;
  }
};
