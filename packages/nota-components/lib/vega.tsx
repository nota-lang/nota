import { some } from "@nota-lang/nota-common/dist/option.js";
import React from "react";
import { VegaLite as VegaLiteBase, ViewListener } from "react-vega";
import { TopLevelSpec } from "vega-lite";

import { DefinitionsPlugin } from "./definitions.js";
import { usePlugin } from "./plugin.js";
import { ScrollPlugin } from "./scroll.js";

export let VegaLite: React.FC<{ spec: TopLevelSpec; name?: string }> = ({ spec, name }) => {
  let definitions = usePlugin(DefinitionsPlugin);
  let scroll = usePlugin(ScrollPlugin);

  let onNewView: ViewListener = view => {
    let root = (view.scenegraph() as any).root;
    let rootItems = root.items[0].items;

    let specAny = spec as any;
    let encoding = specAny.encoding;
    let facetFieldDef = encoding.row || encoding.column || encoding.facet;
    if (facetFieldDef) {
      let facetField = facetFieldDef.field;
      let scope = rootItems.find((item: any) => item.role == "scope")!;
      let facets = scope.items;
      facets.forEach((facet: any, i: number) => {
        let facetValue = facet.datum[facetField];
        let marks = facet.items.find((item: any) => item.role == "mark");
        let encoding = { ...specAny.encoding };
        delete encoding.row;
        delete encoding.column;
        delete encoding.fact;
        let ttSpec = {
          ...specAny,
          transform: [
            ...(specAny.transform || []),
            { filter: `datum.${facetField} == ${JSON.stringify(facetValue)}` },
          ],
          encoding,
        };
        let tooltip = () => <VegaLiteBase spec={ttSpec} renderer="svg" />;
        let facetName = `${name}_${facetValue}`;
        definitions.addDefinition(facetName, {
          tooltip: some(tooltip),
          label: some(<>Plot {i + 1}</>),
        });
        let defId = `def-${facetName}`;
        scroll.registerScrollHook(defId, () => {
          marks._svg.classList.add("yellowflash-outline");
        });
        marks._svg.id = defId;
      });
    }
  };
  return <VegaLiteBase spec={spec} renderer="svg" onNewView={onNewView} />;
};
