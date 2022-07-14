import { some } from "@nota-lang/nota-common/dist/option.js";
import React, { useContext } from "react";
import { VegaLite as VegaLiteBase, View, ViewListener } from "react-vega";
import { TopLevelSpec } from "vega-lite";

import { DefinitionScopeContext, DefinitionsPlugin } from "./definitions.js";
import { usePlugin } from "./plugin.js";

interface VegaLabel {
  spec: any;
  name: string;
  label: string;
  svg: SVGElement;
}

let specToLabels = (view: View, spec: any): VegaLabel[] => {
  let root = (view.scenegraph() as any).root;
  let rootItems = root.items[0].items;

  let labelDirs: { [key: string]: string[][] } = {
    row: [
      ["Top", "Bottom"],
      ["Top", "Middle", "Bottom"],
    ],
    column: [
      ["Left", "Right"],
      ["Left", "Center", "Right"],
    ],
  };

  let labelFor = (dir: string, i: number, n: number, v: string) => {
    if (labelDirs[dir]) {
      if (n == 2 || n == 3) {
        return labelDirs[dir][n - 2][i];
      }
    }
    return v;
  };

  let labels: VegaLabel[] = [];

  let encoding = spec.encoding;
  let facetFieldDef = encoding
    ? "row" in encoding
      ? encoding.row
      : "column" in encoding
      ? encoding.column
      : "facet" in encoding
      ? encoding.facet
      : undefined
    : undefined;

  let concatDef = "hconcat" in spec ? spec.hconcat : "vconcat" in spec ? spec.vconcat : undefined;
  if (facetFieldDef) {
    let facetDim = encoding.row ? "row" : encoding.column ? "column" : "facet";
    let facetField = facetFieldDef.field;
    let scope = rootItems.find((item: any) => item.role == "scope")!;
    let facets = scope.items;
    labels = facets.map((facet: any, i: number) => {
      let facetValue = facet.datum[facetField];
      let marks = facet.items.find((item: any) => item.role == "mark");
      let markColor = marks.items[0].fill;

      // Generate spec for graph in definition label
      let encoding = {
        ...spec.encoding,
        color: { field: facetField, scale: { range: [markColor] } },
      };
      delete encoding[facetDim];
      let ttSpec = {
        ...spec,
        transform: [
          ...(spec.transform || []),
          { filter: `datum.${facetField} == ${JSON.stringify(facetValue)}` },
        ],
        encoding,
      };

      let labelText = labelFor(facetDim, i, facets.length, facetValue);

      return {
        spec: ttSpec,
        name: facetValue,
        label: labelText,
        svg: marks._svg,
      };
    });
  } else if (concatDef) {
    let concatDim = spec.hconcat ? "column" : "row";
    labels = concatDef.map((subspec: any, i: number) => {
      let name = labelFor(concatDim, i, concatDef.length, "");
      let ttSpec = { ...subspec, data: spec.data };
      return {
        spec: ttSpec,
        name,
        label: name,
        svg: rootItems[i]._svg,
      };
    });
  }

  return labels;
};

export let VegaLite: React.FC<{ spec: TopLevelSpec; name?: string }> = ({ spec, name }) => {
  let definitions = usePlugin(DefinitionsPlugin);
  let defScope = useContext(DefinitionScopeContext);

  let onNewView: ViewListener = view => {
    if (name) {
      let labels = specToLabels(view, spec);
      // console.log(labels);

      labels.forEach(({ spec, label: labelText, name: labelName, svg }) => {
        let tooltip = some(<VegaLiteBase spec={spec} renderer="svg" />);
        let label = some(<>{labelText}</>);
        let defName = `${name}_${labelName}`;
        let fullDefName = definitions.addDefinition(defName, defScope, { tooltip, label });
        svg.id = definitions.nameToHtmlId(fullDefName);
      });
    }
  };

  return <VegaLiteBase spec={spec} renderer="svg" onNewView={onNewView} />;
};
