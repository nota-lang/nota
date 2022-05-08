import React, { useState, useEffect, forwardRef } from "react";
import _ from "lodash";
import classNames from "classnames";
import { makeObservable, observable, action } from "mobx";
import { observer } from "mobx-react";

import { Container, ReactConstructor, ReactNode } from "./utils.js";
import { LocalLink } from "./scroll.js";
import { Tooltip } from "./tooltip.js";
import { Plugin, Pluggable, usePlugin } from "./plugin.js";
import { HTMLAttributes, getOrRender } from "./utils.js";
import { Option, some, none, isSome, optUnwrap } from "@nota-lang/nota-common/dist/option.js";
import { NotaText, joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";

export interface DefinitionData {
  tooltip: Option<ReactConstructor | ReactNode>;
  label: Option<ReactConstructor | ReactNode>;
}

class DefinitionsData extends Pluggable {
  defs: { [name: string]: DefinitionData } = {};
  defMode: boolean = false;
  usedDefinitions: Set<string> = new Set();
  stateful = true;

  constructor() {
    super();
    makeObservable(this, {
      defs: observable.shallow,
      defMode: observable,
      usedDefinitions: observable,
    });
  }

  registerUse = action((name: string) => {
    this.usedDefinitions.add(name);
  });

  getDefinition = (name: string): DefinitionData | undefined => {
    return this.defs[name];
  };

  addDefinition = action((name: string, def: DefinitionData) => {
    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
  });

  allDefinitions = (namespace?: string): { [name: string]: DefinitionData } => {
    return _.fromPairs(
      Object.keys(this.defs)
        .filter(name => (namespace ? name.startsWith(namespace) : true))
        .map(name => [name, this.defs[name]])
    );
  };

  init() {
    // TODO: make this less annoying
    // let on_keydown = action(({ key }: KeyboardEvent) => {
    //   if (key === "Alt") {
    //     this.def_mode = true;
    //   }
    // });
    // let on_keyup = action(({ key }: KeyboardEvent) => {
    //   if (key == "Alt") {
    //     this.def_mode = false;
    //   }
    // });
    // useEffect(() => {
    //   window.addEventListener("keydown", on_keydown);
    //   window.addEventListener("keyup", on_keyup);
    //   return () => {
    //     window.removeEventListener("keydown", on_keydown);
    //     window.removeEventListener("keyup", on_keyup);
    //   };
    // }, []);
  }
}

export let DefinitionsPlugin = new Plugin(DefinitionsData);

let nameToId = (name: string): string => `def-${name.replace(":", "-")}`;

export let DefinitionAnchor: React.FC<{
  name: string;
  block?: boolean;
  attrs?: HTMLAttributes;
}> = ({ name, block, attrs, children }) => (
  <Container block={block} id={nameToId(name)} className="definition" {...attrs}>
    {children}
  </Container>
);

interface DefinitionProps {
  name?: NotaText;
  block?: boolean;
  tooltip?: ReactConstructor | ReactNode;
  label?: ReactConstructor<any> | ReactNode;
  attrs?: HTMLAttributes;
}

export let Definition: React.FC<DefinitionProps> = props => {
  let ctx = usePlugin(DefinitionsPlugin);
  let [nameStr] = useState(props.name ? joinRecursive(props.name) : _.uniqueId());

  useEffect(() => {
    let tooltip: DefinitionData["tooltip"];
    if (props.tooltip === null) {
      tooltip = none();
    } else if (props.tooltip === undefined) {
      tooltip = some(props.children);
    } else {
      tooltip = some(props.tooltip);
    }

    let label: DefinitionData["label"] = props.label ? some(props.label) : none();

    ctx.addDefinition(nameStr, { tooltip, label });
  }, []);

  return props.children ? (
    <DefinitionAnchor block={props.block} name={nameStr} attrs={props.attrs}>
      {props.children}
    </DefinitionAnchor>
  ) : null;
};

interface RefProps {
  block?: boolean;
  nolink?: boolean;
  label?: ReactConstructor | ReactNode;
  children: NotaText;
}

export let Ref: React.FC<RefProps> = observer(
  ({ block, nolink, children, label: userLabel, ...props }) => {
    let name = joinRecursive(children);

    let ctx = usePlugin(DefinitionsPlugin);
    useEffect(() => {
      ctx.registerUse(name);
    }, []);

    let def = ctx.getDefinition(name);
    if (!def) {
      return <span className="error">{name}</span>;
    }

    let label = userLabel !== undefined ? some(userLabel) : def.label;
    let inner = isSome(label) ? (
      getOrRender(optUnwrap(label), { name, ...props })
    ) : (
      <span className="error">
        No label defined for <q>{name}</q>
      </span>
    );

    let scrollEvent = isSome(def.tooltip) ? "onDoubleClick" : "onClick";
    let Inner = forwardRef<HTMLAnchorElement>(function Inner(innerProps, ref) {
      return (
        <LocalLink
          ref={ref}
          block={block}
          target={nameToId(name)}
          event={scrollEvent}
          className={classNames("ref", { nolink })}
          {...innerProps}
        >
          {inner}
        </LocalLink>
      );
    });

    if (isSome(def.tooltip)) {
      return <Tooltip Popup={optUnwrap(def.tooltip)}>{Inner}</Tooltip>;
    } else {
      return <Inner />;
    }
  }
);
