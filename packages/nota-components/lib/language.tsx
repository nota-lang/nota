import { zipExn } from "@nota-lang/nota-common";
import {
  NestedArray,
  NotaFn,
  NotaText,
  addBetween,
} from "@nota-lang/nota-common/dist/nota-text.js";
import { none, some } from "@nota-lang/nota-common/dist/option.js";
import _ from "lodash";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAsync } from "react-async";

import { DefinitionData, DefinitionsPlugin } from "./definitions.js";
import { usePlugin } from "./plugin.js";
import { $$, TexPlugin, texDefAnchor, texRef } from "./tex.js";

const r = String.raw;

export type InputSyntaxBranch = [string, NotaFn, (() => NotaText[])?];
export type InputSyntaxSort = [string, string, NotaText, InputSyntaxBranch[]?];
export type InputGrammar = InputSyntaxSort[];

type SyntaxBranch = {
  subcmd: string;
  body: NotaFn;
  args: () => NotaText[];
};
type SyntaxSort = {
  kind: string;
  cmd: string;
  metavar: NotaText;
  branches: SyntaxBranch[];
};
type Grammar = SyntaxSort[];

export interface BnfProps {
  subset?: (string | [string, string[]])[];
  layout?: {
    columns: number;
    cutoff: number;
  };
}

export class Language {
  _grammar: Grammar;

  constructor(grammar: () => InputGrammar) {
    this._grammar = grammar.call(this).map(([kind, cmd, metavar, inBranches]) => {
      let branches = (inBranches || []).map(([subcmd, body, args]) => ({
        subcmd,
        body,
        args: args || (() => []),
      }));
      return { kind, cmd, metavar, branches };
    });

    this._grammar.forEach(({ cmd, metavar, branches }) => {
      (this as any)[cmd] = texRef([`tex_`, cmd], metavar);
      branches.forEach(({ subcmd, body }) => {
        if (typeof body != "function") {
          throw `Not a function: ${(body as any).toString()}`;
        }
        (this as any)[cmd + subcmd] = (...args: any[]) =>
          texRef([`tex_`, cmd, subcmd], body(...args));
      });
    });
  }

  BnfInner: React.FC<BnfProps & { containerRef: HTMLDivElement }> = props => {
    let defCtx = usePlugin(DefinitionsPlugin);
    let texCtx = usePlugin(TexPlugin);

    let branchToTex =
      (cmd: string) =>
      ({ subcmd, args }: SyntaxBranch): NotaText => {
        if (typeof args != "function") {
          throw `Not a function: ${(args as any).toString()}`;
        }
        let argStr = (this as any)[cmd + subcmd](...args());
        return texDefAnchor([cmd + subcmd], argStr);
      };

    let {
      data: branchDims,
      isPending,
      error,
    } = useAsync(
      useCallback(async () => {
        let branchDims = await Promise.all(
          this._grammar.map(({ cmd, branches }) =>
            Promise.all(
              branches
                .map(branchToTex(cmd))
                .map(tex => texCtx.dimensions(tex, false, props.containerRef))
            )
          )
        );
        return branchDims;
      }, [])
    );

    // Have to pull out add_definition calls into an effect to avoid
    // "setState while rendering component" errors
    let defs: [string, DefinitionData][] = [];
    useEffect(() => {
      if (branchDims) {
        defs.forEach(([name, def]) => defCtx.addDefinition(name, def));
      }
    }, [branchDims]);

    if (isPending) {
      return null;
    }

    if (!branchDims) {
      console.error(error);
      return null;
    }

    const MAX_ROW_WIDTH = 350;

    let subset = props.subset?.map<[string, string[] | true]>(t => {
      if (typeof t == "string") {
        return [t, true];
      } else {
        return t;
      }
    });

    let sizedProductions = zipExn(this._grammar, branchDims);
    if (subset) {
      sizedProductions = subset.map(([k]) => {
        let prod = sizedProductions.find(([{ cmd }]) => k == cmd);
        if (!prod) {
          console.error(`No production named: ${k}`);
          throw new Error(`No production named: ${k}`);
        }
        return prod;
      });
    }

    let rules = sizedProductions.map(([{ kind, cmd, metavar, branches }, bdims]) => {
      let makeRhs = (hl?: string) => {
        if (branches.length == 0) {
          return "";
        }

        let sizedBranches = zipExn(branches, bdims);
        let branchesAreSubset = false;
        if (subset) {
          let [_k, subsetBranches] = subset.find(([k]) => k == cmd)!;
          if (subsetBranches !== true) {
            branchesAreSubset = true;
            sizedBranches = subsetBranches.map(k2 => {
              let branch = sizedBranches.find(([{ subcmd }]) => subcmd == k2);
              if (!branch) {
                console.error(`No branch in production ${cmd} named: ${k2}`);
                throw new Error(`No branch in production ${cmd} named: ${k2}`);
              }
              return branch;
            });
          }
        }

        let [rows] = sizedBranches.reduce(
          ([rows, curWidth], [branch, dims]) => {
            let lastRow = rows[rows.length - 1];
            if (curWidth + dims.width > MAX_ROW_WIDTH && lastRow.length > 0) {
              rows.push([branch]);
              curWidth = dims.width;
            } else {
              lastRow.push(branch);
              curWidth += dims.width;
            }
            return [rows, curWidth];
          },
          [[[]] as SyntaxBranch[][], 0]
        );
        let str = addBetween(
          rows
            // if we're highlighting a specific branch, then remove other rows
            .filter(row => !hl || _.some(row, branch => branch.subcmd == hl))
            .map(row => {
              let addEllipsis = (hl && rows.length > 1) || branchesAreSubset;
              return (
                addBetween(
                  row.map(branch => {
                    let tex = branchToTex(cmd)(branch);
                    if (hl && branch.subcmd == hl) {
                      tex = [r`\htmlClass{tex-highlight}{`, tex, `}`];
                    }
                    return tex;
                  }),
                  r`\mid`
                ) as NestedArray<any>
              ).concat(addEllipsis ? [r`\mid \ldots`] : []);
            }),
          r`\\& & & && &&\mid`
        );
        return [`::= ~ &&`, str];
      };

      kind = kind.replace(/ /g, r`\ `);

      branches.forEach(({ subcmd }) => {
        let rhs = makeRhs(subcmd);
        defs.push([
          `tex_${cmd}${subcmd}`,
          {
            tooltip: some(() => (
              <$$ className="nomargin">
                {[
                  r`\begin{aligned}&\mathsf{`,
                  kind,
                  `}& ~ &`,
                  metavar,
                  `&&`,
                  rhs,
                  r`\end{aligned}`,
                ]}
              </$$>
            )),
            label: none(),
          },
        ]);
      });

      let rhs = makeRhs();
      defs.push([
        `tex_${cmd}`,
        {
          tooltip: some(() => (
            <$$ className="nomargin">
              {[
                r`\begin{aligned}&\mathsf{`,
                kind,
                r`}& ~ &\htmlClass{tex-highlight}{`,
                metavar,
                `} &&`,
                rhs,
                r`\end{aligned}`,
              ]}
            </$$>
          )),
          label: none(),
        },
      ]);
      return [r`&\htmlData{def=`, cmd, r`}{\mathsf{`, kind, `}}& ~ &`, metavar, ` &&`, rhs];
    });

    let layout = props.layout || {
      columns: 1,
      cutoff: 0,
    };

    let columns = layout.columns > 1 ? _.chunk(rules, layout.cutoff) : [rules];
    let sep = r`
%
\hspace{2em}
%
`;
    let finalTex = addBetween(
      columns.map(col => [r`\begin{aligned}`, addBetween(col, r`\\`), r`\end{aligned}`]),
      sep
    );

    return <$$>{finalTex}</$$>;
  };

  Bnf: React.FC<BnfProps> = props => {
    let ref = useRef<HTMLDivElement>(null);

    // Needed for BnfInner to render once ref.current !== null
    let [_, rerender] = useState(false);
    useEffect(() => rerender(true), []);

    return (
      <div ref={ref}>
        {ref.current ? <this.BnfInner containerRef={ref.current} {...props} /> : null}
      </div>
    );
  };
}
