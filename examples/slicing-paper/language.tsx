import { Language } from "@wcrichto/nota";

const r = String.raw;

let msf = s => r`\mathsf{${s}}`;
let id = x => x;
let noargs = () => [];
let textsc = s => r`\text{\tiny ${s}}`;

// prettier-ignore
export let L = new Language(function() {
  return [["Variable", "vr", "x", []],
  ["Function", "fname", "f", []],
  ["Number", "num", "n", []],  
  ["Path", "path", "q", [
    [r`empty`, 0, () => r`\varepsilon`, noargs], 
    [r`elem`, 2, (x, y) => r`${x}.${y}`, () => [this.num(), this.path()]]]],
  ["Place", "plc", r`\pi`, [
    [r`form`, 2, (x, y) => r`${x}.${y}`, () => [this.vr(), this.path()]]]],
  ["Place Expression", "pexp", `p`, [
    [`var`, 1, id, () => [this.vr()]], 
    [`elem`, 2, (x, y) => r`${x}.${y}`, () => [this.pexp(), this.num()]],
    [`deref`, 1, x => r`\ast ${x}`, () => [this.pexp()]]]],
  ["Constant", "const", "c", [
    [`unit`, 0, () => "()", noargs],
    [`num`, 1, id, () => [this.num()]],
    [`true`, 0, () => msf("true"), noargs],
    [`false`, 0, () => msf("false"), noargs]]],
  ["Concrete Provenance", "concrprov", "r", []],
  ["Abstract Provenance", "abstrprov", r`\varrho`, []],
  ["Provenance", "prov", r`\rho`, [
    ["concr", 1, id, () => [this.concrprov()]],
    ["abstr", 1, id, () => [this.abstrprov()]]]],
  ["Ownership Qualifier", "ownq", r`\omega`, [
    ["shrd", 0, () => msf("shrd"), noargs],
    ["uniq", 0, () => msf("uniq"), noargs]]],
  ["Base Type", "tyb", r`\tau^${textsc("B")}`, [
    ["unit", 0, () => msf("unit"), noargs],
    ["num", 0, () => msf("u32"), noargs],
    ["bool", 0, () => msf("bool"), noargs]]],
  ["Sized Type", "tys", r`\tau^${textsc("SI")}`, [
    ["base", 1, id, () => [this.tyb()]],
    ["ref", 3, (x, y, z) => r`\&${x}~${y}~${z}`, 
      () => [this.prov(), this.ownq(), r`\tau^${textsc("XI")}`]],
    ["tup", 1, x => r`(${x})`, () => [r`${this.tys()}_1, \ldots, ${this.tys()}_n`]]]],
  ["Expression", "expr", "e", [
    ["const", 1, id, () => [this.const()]],
    ["pexp", 1, id, () => [this.pexp()]],
    ["ref", 3, (x, y, z) => r`\&${x}~${y}~${z}`, 
      () => [this.concrprov(), this.ownq(), this.pexp()]],
    ["ite", 3, (x, y, z) => r`${msf("if")}~${x}~\{\,${y}\,\}~${msf("else")}~\{\,${z}\,\}`,
      () => [r`${this.expr()}_1`, r`${this.expr()}_2`, r`${this.expr()}_3`]],
    ["let", 4, (x, y, z, w) => r`${msf("let")}~${x} : ${y} = ${z}; ~ ${w}`,
      () => [this.expr() + '_1', this.tys(), this.expr() + '_2', this.expr() + '_3']],
    ["plcasgn", 2, (x, y) => r`${x} \mathrel{:=} ${y}`, () => [this.plc(), this.expr()]],
    ["pexpasgn", 2, (x, y) => r`${x} \mathrel{:=} ${y}`, () => [this.pexp(), this.expr()]],
    ["seq", 2, (x, y) => `${x};~${y}`, () => [this.expr() + '_1', this.expr() + '_2']],
    ["call", 5, 
      (x, y, z, w, v) => r`${x}\left\langle${y}, ${z}, ${w}\right\rangle\left(${v}\right)`,
      () => [this.fname(), r`\overline{\Phi}`, r`\overline{\rho}`, r`\overline{\tau}`, this.plc()]],
    ["tup", 1, x => `(${x})`, () => [r`${this.expr()}_1, \ldots, ${this.expr()}_n`]],
    ["prov", 2, (x, y) => r`${msf("letprov")}\langle${x}\rangle\,\{${y}\}`, 
      () => [this.concrprov(), this.expr()]]
    ]],
  ["Global Entries", "fdef", r`\varepsilon`, [
    ["form", 9, 
      (x0, x1, x2, x3, x4, x5, x6, x7, x8) => 
        r`${msf("fn")}~${x0}\left\langle ${x1}, ${x2}, ${x3}, \right\rangle\left(${x4} : ${x5}\right) \rightarrow ${x6} ~ ${msf("where")} ~ ${x7} ~ \{\,${x8}\,\}`,
      () => 
        [this.fname(), r`\overline{\psi}`, r`\overline{${this.abstrprov()}}`, r`\overline{\alpha}`,
        this.vr(), this.tys() + '_a', this.tys() + '_r', r`\overline{${this.abstrprov()}_1 : ${this.abstrprov()}_2}`, this.expr()]]]],
  ["Global Environment", "fenv", r`\Sigma`, [
    ["empty", 0, () => r`\bullet`, noargs],
    ["with", 2, (x, y) => r`${x}, ${y}`, () => [this.fenv(), this.fdef()]]]]
  ]
  });

// export let OxideExtra = new Language([
//   [
//     "Dead Types",
//     "tyd",
//     r`\tau^\textsc{SD}`,
//     [
//       ["s", 1, r`{#1}^\dagger`, [r`\tys`]],
//       ["tup", 1, r`({#1})`, [r`\tyd_1, \ldots, \tyd_n`]],
//     ],
//   ],
//   [
//     "Maybe Unsized Type",
//     "tyx",
//     r`\tau^\textsc{XI}`,
//     [
//       ["s", 1, "{#1}", [r`\tys`]],
//       ["a", 1, "[{#1}]", [r`\tys`]],
//     ],
//   ],
//   [
//     "Maybe Dead Types",
//     "tysx",
//     r`\tau^\textsc{SX}`,
//     [
//       ["s", 1, "{#1}", [r`\tys`]],
//       ["d", 1, "{#1}", [r`\tyd`]],
//       ["tup", 1, "({#1})", [r`\tysx_1, \ldots, \tysx_n`]],
//     ],
//   ],
//   [
//     "Type",
//     "ty",
//     r`\tau`,
//     [
//       ["tyx", 1, "{#1}", [r`\tyx`]],
//       ["tysx", 1, "{#1}", [r`\tysx`]],
//     ],
//   ],
//   ["Loan", "loan", r`\ell`, [[`form`, 2, r`\,^{#1}{#2}`, [r`\ownq`, r`\pexp`]]]],
//   ["Frame Var", "frmvar", r`\varphi`, []],
//   [
//     "Frame Typing",
//     "ft",
//     r`\mathcal{F}`,
//     [
//       ["empty", 0, r`\bullet`, []],
//       ["wty", 3, "{#1}, {#2} : {#3}", [r`\ft`, r`\vr`, r`\tyx`]],
//       ["wlf", 3, r`{#1}, {#2} \mapsto {#3}`, [r`\ft`, r`\concrprov`, r`\setof{\loan}`]],
//     ],
//   ],
//   [
//     "Stack Typing",
//     "stackenv",
//     r`\Gamma`,
//     [
//       ["empty", 0, r`\bullet`, []],
//       ["wfr", 2, r`{#1} \mathrel{\natural} {#2}`, [r`\stackenv`, r`\ft`]],
//     ],
//   ],
//   [
//     "Kind",
//     "kind",
//     r`\kappa`,
//     [
//       ["base", 0, r`\bigstar`, []],
//       ["prv", 0, r`\msf{PRV}`, []],
//       ["frm", 0, r`\msf{FRM}`, []],
//     ],
//   ],
//   ["Type Var", "tyvar", r`\alpha`, []],
//   [
//     "Type Environment",
//     "tyenv",
//     r`\Delta`,
//     [
//       ["empty", 0, r`\bullet`, []],
//       ["wtvar", 2, r`{#1}, {#2} : \kindbase`, [r`\tyenv`, r`\tyvar`]],
//       ["wprv", 2, r`{#1}, {#2} : \kindprv`, [r`\tyenv`, r`\abstrprov`]],
//       ["wfrm", 2, r`{#1}, {#2} : \kindfrm`, [r`\tyenv`, r`\frmvar`]],
//       ["wconstr", 3, r`{#1}, {#2} \mathrel{:>} {#3}`, [r`\tyenv`, r`\abstrprov`, r`\abstrprov'`]],
//     ],
//   ],
// ]);
