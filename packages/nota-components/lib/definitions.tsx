import React, { useState, useEffect, forwardRef } from "react";
import _ from "lodash";
import classNames from "classnames";
import { makeObservable, observable, action } from "mobx";
import { observer } from "mobx-react";

import { Container } from "./utils";
import { ScrollPlugin } from "./scroll";
import { Tooltip } from "./tooltip";
import { Plugin, Pluggable, usePlugin } from "./plugin";
import { HTMLAttributes } from "./utils";
import { join_recursive } from "@nota-lang/nota-common";

export interface DefinitionData {
  Tooltip: React.FC | null;
  Label: React.FC<any> | JSX.Element | null;
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

interface DefinitionProps {
  name?: JSX.Element | string;
  block?: boolean;
  Tooltip?: React.FC | null;
  Label?: React.FC<any>;
}

let name_to_id = (name: string): string => `def-${name.replace(":", "-")}`;

export let DefinitionAnchor: React.FC<{ name: string; block?: boolean } & HTMLAttributes> = ({
  name,
  block,
  ...props
}) => (
  <Container block={block} id={name_to_id(name)} {...props}>
    {props.children}
  </Container>
);

export let Definition: React.FC<DefinitionProps & HTMLAttributes> = ({
  name,
  block,
  Tooltip,
  Label,
  ...props
}) => {
  let ctx = usePlugin(DefinitionsPlugin);
  let [name_str] = useState(name ? join_recursive(name as any) : _.uniqueId());

  useEffect(() => {
    ctx.add_definition(name_str, {
      Tooltip: Tooltip ? Tooltip : () => <>{props.children}</>,
      Label: Label || null,
    });
  }, []);

  return props.children ? (
    <DefinitionAnchor block={block} name={name_str} {...props}>
      {props.children}
    </DefinitionAnchor>
  ) : null;
};

interface RefProps {
  block?: boolean;
  nolink?: boolean;
  Element?: JSX.Element;
}

export let Ref: React.FC<RefProps> = observer(({ block, nolink, children, Element, ...props }) => {
  let name = join_recursive(children as any);

  let ctx = usePlugin(DefinitionsPlugin);
  let scroll_plugin = usePlugin(ScrollPlugin);
  useEffect(() => {
    ctx.register_use(name);
  }, []);

  let def = ctx.get_definition(name);
  if (!def) {
    return <span className="error">{name}</span>;
  }

  let on_click: React.MouseEventHandler = e => {
    e.preventDefault();
    e.stopPropagation();

    scroll_plugin.scroll_to(name_to_id(name));
  };

  let inner: JSX.Element = def.Label ? (
    typeof def.Label == "function" ? (
      <def.Label name={name} {...props} />
    ) : (
      def.Label
    )
  ) : (
    Element || <span className="error">No label defined for &ldquo;{name}&rdquo;</span>
  );

  let scroll_event = def.Tooltip ? "onDoubleClick" : "onClick";
  let event_props = { [scroll_event]: on_click };

  let Inner = forwardRef<HTMLDivElement>(function Inner(inner_props, ref) {
    return (
      <Container
        ref={ref}
        block={block}
        className={classNames("ref", { nolink })}
        {...inner_props}
        {...event_props}
      >
        {inner}
      </Container>
    );
  });

  if (def.Tooltip) {
    return <Tooltip Inner={Inner} Popup={def.Tooltip} />;
  } else {
    return <Inner />;
  }
});
