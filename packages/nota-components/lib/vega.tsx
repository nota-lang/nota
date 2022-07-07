import { some } from "@nota-lang/nota-common/dist/option.js";
import React, { useContext } from "react";
import { VegaLite as VegaLiteBase, ViewListener } from "react-vega";
import { TopLevelSpec } from "vega-lite";

import { DefinitionScopeContext, DefinitionsPlugin } from "./definitions.js";
import { usePlugin } from "./plugin.js";

export let VegaLite: React.FC<{ spec: TopLevelSpec; name?: string }> = ({ spec, name }) => {
  let definitions = usePlugin(DefinitionsPlugin);
  let defScope = useContext(DefinitionScopeContext);

  let onNewView: ViewListener = view => {
    let root = (view.scenegraph() as any).root;
    let rootItems = root.items[0].items;

    let specAny = spec as any;
    let encoding = specAny.encoding;
    let facetFieldDef = encoding.row || encoding.column || encoding.facet;

    if (facetFieldDef) {
      let facetDim = encoding.row ? "row" : encoding.column ? "column" : "facet";
      let facetField = facetFieldDef.field;
      let scope = rootItems.find((item: any) => item.role == "scope")!;
      let facets = scope.items;
      facets.forEach((facet: any, i: number) => {
        let facetValue = facet.datum[facetField];
        let marks = facet.items.find((item: any) => item.role == "mark");
        let markColor = marks.items[0].fill;

        // Generate spec for graph in definition label
        let encoding = {
          ...specAny.encoding,
          color: { field: facetField, scale: { range: [markColor] } },
        };
        delete encoding[facetDim];
        let ttSpec = {
          ...specAny,
          transform: [
            ...(specAny.transform || []),
            { filter: `datum.${facetField} == ${JSON.stringify(facetValue)}` },
          ],
          encoding,
        };
        let tooltip = some(<VegaLiteBase spec={ttSpec} renderer="svg" />);

        let labels: { [key: string]: string[][] } = {
          row: [
            ["Top", "Bottom"],
            ["Top", "Middle", "Bottom"],
          ],
          column: [
            ["Left", "Right"],
            ["Left", "Center", "Right"],
          ],
        };
        let labelText;
        if (labels[facetDim]) {
          let n = facets.length;
          if (n == 2 || n == 3) {
            labelText = labels[facetDim][n - 2][i];
          }
        }
        if (!labelText) {
          labelText = facetValue;
        }
        let label = some(<>{labelText}</>);

        let facetName = `${name}_${facetValue}`;
        let defName = definitions.addDefinition(facetName, defScope, { tooltip, label });
        marks._svg.id = definitions.nameToHtmlId(defName);
      });
    }
  };

  return <VegaLiteBase spec={spec} renderer="svg" onNewView={onNewView} />;
};
