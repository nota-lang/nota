import { NotaText, addBetween, joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import { Option, isSome, none, optUnwrap, some } from "@nota-lang/nota-common/dist/option.js";
import { default as classNames } from "classnames";
import _ from "lodash";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { forwardRef, useContext, useEffect, useState } from "react";

import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { LocalLink } from "./scroll.js";
import { Tooltip } from "./tooltip.js";
import { Container, FCC, ReactConstructor, ReactNode } from "./utils.js";
import { HTMLAttributes, getOrRender } from "./utils.js";

export interface DefinitionData {
  tooltip: Option<ReactConstructor | ReactNode>;
  label: Option<ReactConstructor | ReactNode>;
}

export class DefinitionsData extends Pluggable {
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

  addDefinition = action((name: string, scope: string[], def: DefinitionData): string => {
    if (scope.length > 0) {
      name = [...scope, name].join("_");
      let label = def.label;
      def = {
        ...def,
        label: some(() => {
          let labels = [...scope.map(name => this.defs[name].label), label];
          return addBetween(
            labels.map(optUnwrap).map((label, i) => getOrRender(label, { key: i })),
            "-"
          );
        }),
      };
    }

    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
    return name;
  });

  allDefinitions = (namespace?: string): { [name: string]: DefinitionData } => {
    return _.fromPairs(
      Object.keys(this.defs)
        .filter(name => (namespace ? name.startsWith(namespace) : true))
        .map(name => [name, this.defs[name]])
    );
  };

  nameToHtmlId = (name: string): string => `def-${name.replace(":", "-")}`;

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

export let DefinitionAnchor: FCC<{
  name: string;
  block?: boolean;
  attrs?: HTMLAttributes;
}> = ({ name, block, attrs, children }) => {
  let ctx = usePlugin(DefinitionsPlugin);
  return (
    <Container block={block} id={ctx.nameToHtmlId(name)} className="definition" {...attrs}>
      {children}
    </Container>
  );
};

export let DefinitionScopeContext = React.createContext<string[]>([]);

export let DefinitionScope: FCC<{ name: string }> = ({ children, name }) => {
  let curScope = useContext(DefinitionScopeContext);
  let newScope = [...curScope, name];
  return (
    <DefinitionScopeContext.Provider value={newScope}>{children}</DefinitionScopeContext.Provider>
  );
};

interface DefinitionProps {
  name?: NotaText;
  names?: NotaText[];
  block?: boolean;
  tooltip?: ReactConstructor | ReactNode;
  label?: ReactConstructor<any> | ReactNode;
  attrs?: HTMLAttributes;
}

export let Definition: FCC<DefinitionProps> = props => {
  let ctx = usePlugin(DefinitionsPlugin);
  let scope = useContext(DefinitionScopeContext);
  let [nameStrs] = useState(() =>
    props.names
      ? props.names.map(s => joinRecursive(s))
      : props.name
      ? [joinRecursive(props.name)]
      : [_.uniqueId()]
  );

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
    nameStrs.forEach(name => ctx.addDefinition(name, scope, { tooltip, label }));
  }, []);

  return props.children
    ? nameStrs.reduce(
        (child, name, i) => (
          <DefinitionAnchor key={i} block={props.block} name={name} attrs={props.attrs}>
            {child}
          </DefinitionAnchor>
        ),

        // weird that it wouldn't type check to just return props.children?
        props.children as React.ReactElement<any, any>
      )
    : null;
};

interface RefProps {
  block?: boolean;
  nolink?: boolean;
  label?: ReactConstructor | ReactNode;
}

export let Ref: FCC<RefProps> = observer(
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
    let RefInner = forwardRef<HTMLAnchorElement>(function RefInner(innerProps, ref) {
      return (
        <LocalLink
          ref={ref}
          block={block}
          target={ctx.nameToHtmlId(name)}
          event={scrollEvent}
          className={classNames("ref", { nolink })}
          {...innerProps}
        >
          {inner}
        </LocalLink>
      );
    });

    if (isSome(def.tooltip)) {
      return <Tooltip Popup={optUnwrap(def.tooltip)}>{RefInner}</Tooltip>;
    } else {
      return <RefInner />;
    }
  }
);
Ref.displayName = "Ref";
