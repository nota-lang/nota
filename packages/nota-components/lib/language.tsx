import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAsync } from "react-async";
import _ from "lodash";
import {
  add_between,
  NotaText,
  NotaFn,
  some,
  none,
  NestedArray,
  zipExn,
} from "@nota-lang/nota-common";

import { DefinitionsPlugin, DefinitionData } from "./definitions";
import { $$, tex_ref, tex_def_anchor, TexPlugin } from "./tex";
import { usePlugin } from "./plugin";

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
    this._grammar = grammar.call(this).map(([kind, cmd, metavar, in_branches]) => {
      let branches = (in_branches || []).map(([subcmd, body, args]) => ({
        subcmd,
        body,
        args: args || (() => []),
      }));
      return { kind, cmd, metavar, branches };
    });

    this._grammar.forEach(({ cmd, metavar, branches }) => {
      (this as any)[cmd] = tex_ref([cmd], metavar);
      branches.forEach(({ subcmd, body }) => {
        if (typeof body != "function") {
          throw `Not a function: ${(body as any).toString()}`;
        }
        (this as any)[cmd + subcmd] = (...args: any[]) => tex_ref([cmd + subcmd], body(...args));
      });
    });
  }

  BnfInner: React.FC<BnfProps & { container_ref: HTMLDivElement }> = props => {
    let def_ctx = usePlugin(DefinitionsPlugin);
    let tex_ctx = usePlugin(TexPlugin);

    let branch_to_tex =
      (cmd: string) =>
      ({ subcmd, args }: SyntaxBranch): NotaText => {
        if (typeof args != "function") {
          throw `Not a function: ${(args as any).toString()}`;
        }
        let arg_str = (this as any)[cmd + subcmd](...args());
        return tex_def_anchor([cmd + subcmd], arg_str);
      };

    let {
      data: branch_dims,
      isPending,
      error,
    } = useAsync(
      useCallback(async () => {
        let branch_dims = await Promise.all(
          this._grammar.map(({ cmd, branches }) =>
            Promise.all(
              branches
                .map(branch_to_tex(cmd))
                .map(tex => tex_ctx.dimensions(tex, false, props.container_ref))
            )
          )
        );
        return branch_dims;
      }, [])
    );

    // Have to pull out add_definition calls into an effect to avoid
    // "setState while rendering component" errors
    let defs: [string, DefinitionData][] = [];
    useEffect(() => {
      if (branch_dims) {
        defs.forEach(([name, def]) => def_ctx.add_definition(name, def));
      }
    }, [branch_dims]);

    if (isPending) {
      return null;
    }

    if (!branch_dims) {
      console.error(error);
      return null;
    }

    const MAX_ROW_WIDTH = 350;

    let included_cmds: { [cmd: string]: boolean | string[] } | null = null;
    if (props.subset) {
      included_cmds = {};
      props.subset.forEach(t => {
        if (typeof t == "string") {
          included_cmds![t] = true;
        } else {
          included_cmds![t[0]] = t[1];
        }
      });
    }

    let rules = zipExn(this._grammar, branch_dims)
      .filter(([{ cmd }]) => !included_cmds || cmd in included_cmds)
      .map(([{ kind, cmd, metavar, branches }, bdims]) => {
        let make_rhs = (hl?: string) => {
          if (branches.length == 0) {
            return "";
          }

          let [rows] = zipExn(branches, bdims)
            .filter(
              ([{ subcmd }]) =>
                !included_cmds ||
                included_cmds[cmd] === true ||
                (included_cmds[cmd] as any).includes(subcmd)
            )
            .reduce(
              ([rows, cur_width], [branch, dims]) => {
                let last_row = rows[rows.length - 1];
                if (cur_width + dims.width > MAX_ROW_WIDTH && last_row.length > 0) {
                  rows.push([branch]);
                  cur_width = dims.width;
                } else {
                  last_row.push(branch);
                  cur_width += dims.width;
                }
                return [rows, cur_width];
              },
              [[[]] as SyntaxBranch[][], 0]
            );
          let str = add_between(
            rows
              // if we're highlighting a specific branch, then remove other rows
              .filter(row => !hl || _.some(row, branch => branch.subcmd == hl))
              .map(row => {
                let add_dots =
                  (hl && rows.length > 1) ||
                  (included_cmds && typeof included_cmds[cmd] != "boolean");
                return (
                  add_between(
                    row.map(branch => {
                      let tex = branch_to_tex(cmd)(branch);
                      if (hl && branch.subcmd == hl) {
                        tex = [r`\htmlClass{tex-highlight}{`, tex, `}`];
                      }
                      return tex;
                    }),
                    r`\mid`
                  ) as NestedArray<any>
                ).concat(add_dots ? [r`\mid \ldots`] : []);
              }),
            r`\\& & & && &&\mid`
          );
          return [`::= ~ &&`, str];
        };

        kind = kind.replace(/ /g, r`\ `);

        branches.forEach(({ subcmd }) => {
          let rhs = make_rhs(subcmd);
          defs.push([
            `tex:${cmd}${subcmd}`,
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

        let rhs = make_rhs();
        defs.push([
          `tex:${cmd}`,
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
    let final_tex = add_between(
      columns.map(col => [r`\begin{aligned}`, add_between(col, r`\\`), r`\end{aligned}`]),
      sep
    );

    return <$$>{final_tex}</$$>;
  };

  Bnf: React.FC<BnfProps> = props => {
    let ref = useRef<HTMLDivElement>(null);

    // Needed for BnfInner to render once ref.current !== null
    let [_, rerender] = useState(false);
    useEffect(() => rerender(true), []);

    return (
      <div ref={ref}>
        {ref.current ? <this.BnfInner container_ref={ref.current} {...props} /> : null}
      </div>
    );
  };
}
