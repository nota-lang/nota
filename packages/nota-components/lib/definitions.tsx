import React, { useState, useEffect, forwardRef } from "react";
import _ from "lodash";
import classNames from "classnames";
import { makeObservable, observable, action } from "mobx";
import { observer } from "mobx-react";

import { Container, ReactConstructor, ReactNode } from "./utils";
import { LocalLink } from "./scroll";
import { Tooltip } from "./tooltip";
import { Plugin, Pluggable, usePlugin } from "./plugin";
import { HTMLAttributes, get_or_render } from "./utils";
import {
  join_recursive,
  Option,
  some,
  none,
  is_some,
  opt_unwrap,
  NotaText,
} from "@nota-lang/nota-common";

export interface DefinitionData {
  tooltip: Option<ReactConstructor | ReactNode>;
  label: Option<ReactConstructor | ReactNode>;
}

class DefinitionsData extends Pluggable {
  @observable.shallow defs: { [name: string]: DefinitionData } = {};
  @observable def_mode: boolean = false;
  @observable used_definitions: Set<string> = new Set();
  stateful = true;

  constructor() {
    super();
    makeObservable(this);
  }

  register_use = action((name: string) => {
    this.used_definitions.add(name);
  });

  get_definition = (name: string): DefinitionData | undefined => {
    return this.defs[name];
  };

  add_definition = action((name: string, def: DefinitionData) => {
    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
  });

  all_definitions = (namespace?: string): { [name: string]: DefinitionData } => {
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

let name_to_id = (name: string): string => `def-${name.replace(":", "-")}`;

export let DefinitionAnchor: React.FC<{
  name: string;
  block?: boolean;
  attrs?: HTMLAttributes;
}> = ({ name, block, attrs, children }) => (
  <Container block={block} id={name_to_id(name)} className="definition" {...attrs}>
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
  let [name_str] = useState(props.name ? join_recursive(props.name) : _.uniqueId());

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

    ctx.add_definition(name_str, { tooltip, label });
  }, []);

  return props.children ? (
    <DefinitionAnchor block={props.block} name={name_str} attrs={props.attrs}>
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
  ({ block, nolink, children, label: user_label, ...props }) => {
    let name = join_recursive(children);

    let ctx = usePlugin(DefinitionsPlugin);
    useEffect(() => {
      ctx.register_use(name);
    }, []);

    let def = ctx.get_definition(name);
    if (!def) {
      return <span className="error">{name}</span>;
    }

    let label = user_label !== undefined ? some(user_label) : def.label;
    let inner = is_some(label) ? (
      get_or_render(opt_unwrap(label), { name, ...props })
    ) : (
      <span className="error">
        No label defined for <q>{name}</q>
      </span>
    );

    let scroll_event = is_some(def.tooltip) ? "onDoubleClick" : "onClick";
    let Inner = forwardRef<HTMLAnchorElement>(function Inner(inner_props, ref) {
      return (
        <LocalLink
          ref={ref}
          block={block}
          target={name_to_id(name)}
          event={scroll_event}
          className={classNames("ref", { nolink })}
          {...inner_props}
        >
          {inner}
        </LocalLink>
      );
    });

    if (is_some(def.tooltip)) {
      return <Tooltip Popup={opt_unwrap(def.tooltip)}>{Inner}</Tooltip>;
    } else {
      return <Inner />;
    }
  }
);
