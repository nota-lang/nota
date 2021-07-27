import React from "react";
import ReactDOM from "react-dom";
import {
  $,
  $$,
  Cite,
  Ref,
  Footnote,
  Section,
  Title,
  Authors,
  Author,
  Name,
  Affiliation,
  Institution,
  Abstract,
  Document,
  Wrap,
  Row,
  Listing,
  ListingConfigure,
} from "reactex";
import { Language } from "reactex/dist/language";
import { rust } from "@codemirror/lang-rust";
import { SliceListing } from "./slicer";

// @ts-ignore
import bibtex from "./example.bib";

import "../node_modules/reactex/dist/assets.css";

const r = String.raw;
const C: React.FC = (props) => <code {...props} />;

// TODO: abstract out a "counter" context
let Principle: React.FC<{ type: string; text: string }> = ({ type, text }) => (
  <p style={{ margin: "1rem" }}>
    <strong>Principle 1</strong> (Slicing principle for {type}). <em>{text}</em>
  </p>
);

// prettier-ignore
let Oxide = new Language([
  ["Variable", "vr", "x", []],
  ["Function", "fname", "f", []],
  ["Number", "num", "n", []],  
  ["Path", "path", "q", [
    [r`empty`, 0, r`\varepsilon`, []], 
    [r`elem`, 2, r`{#1}.{#2}`, [r`\num`, r`\path`]]]],
  ["Place", "plc", r`\pi`, [
    [r`form`, 2, r`{#1}.{#2}`, [r`\vr`, r`\path`]]]],
  ["Place Expression", "pexp", `p`, [
    [`var`, 1, r`#1`, [r`\vr`]], 
    [`elem`, 2, r`{#1}.{#2}`, [r`\pexp`, r`\num`]], 
    [`deref`, 1, r`\ast {#1}`, [r`\pexp`]]]],
  ["Constant", "const", "c", [
    [`unit`, 0, "()", []],
    [`num`, 1, "#1", [r`\num`]], 
    [`true`, 0, r`\msf{true}`, []],
    [`false`, 0, r`\msf{false}`, []]]],
  ["Concrete Provenance", "concrprov", "r", []],
  ["Abstract Provenance", "abstrprov", r`\varrho`, []],
  ["Provenance", "prov", r`\rho`, [
    ["concr", 1, "#1", [r`\concrprov`]],
    ["abstr", 1, "#1", [r`\abstrprov`]]]],
  ["Ownership Qualifier", "ownq", r`\omega`, [
    ["shrd", 0, r`\msf{shrd}`, []],
    ["uniq", 0, r`\msf{uniq}`, []]]],  
  ["Base Type", "tyb", r`\tau^\textsc{B}`, [
    ["unit", 0, r`\msf{unit}`, []],
    ["num", 0, r`\msf{u32}`, []],
    ["bool", 0, r`\msf{bool}`, []]]],  
  ["Sized Type", "tys", r`\tau^\textsc{SI}`, [
    ["base", 1, "{#1}", [r`\tyb`]],
    ["ref", 3, r`\&{#1}~{#2}~{#3}`, [r`\prov`, r`\ownq`, r`\tau^\textsc{XI}`]],
    ["tup", 1, r`({#1})`, [r`\tys{}_1, \ldots, \tys{}_n`]]]],
  ["Expression", "expr", "e", [
    ["const", 1, "{#1}", [r`\const`]],
    ["pexp", 1, "{#1}", [r`\pexp`]],   
    ["ref", 3, r`\&{#1}~{#2}~{#3}`, [r`\concrprov`, r`\ownq`, r`\pexp`]],
    ["ite", 3, r`\msf{if}~{#1}~\{\,{#2}\,\}~\msf{else}~\{\,{#3}\,\}`, 
      [r`\expr_1`, r`\expr_2`, r`\expr_3`]],
    ["let", 4, r`\msf{let}~{#1} : {#2} = {#3}; ~ {#4}`, 
      [r`\expr_1`, r`\tys`, r`\expr_2`, r`\expr_3`]],
    ["plcasgn", 2, r`{#1} \mathrel{:=} {#2}`, [r`\plc`, r`\expr`]],
    ["pexpagn", 2, r`{#1} \mathrel{:=} {#2}`, [r`\pexp`, r`\expr`]],
    ["seq", 2, r`{#1};~{#2}`, [r`\expr_1`, r`\expr_2`]],
    ["call", 5, r`{#1}\left\langle{#2}, {#3}, {#4}\right\rangle\left({#5}\right)`,
      [r`\fname`, r`\overline{\Phi}`, r`\overline{\rho}`, r`\overline{\tau}`, r`\plc`]]
    ]],
  ["Global Entries", "fdef", r`\varepsilon`, [
    ["form", 9, r`\msf{fn}~{#1}\left\langle {#2}, {#3}, {#4}, \right\rangle\left({#5} : {#6}\right) \rightarrow {#7} ~ \msf{where} ~ {#8} ~ \{\,{#9}\,\}`, 
      [r`\fname`, r`\overline{\psi}`, r`\overline{\abstrprov}`, r`\overline{\alpha}`, 
       r`\vr`, r`\tys_a`, r`\tys_r`, r`\overline{\abstrprov_1 : \abstrprov_2}`, r`\expr`]]]],
  ["Global Environment", "fenv", r`\Sigma`, [
    ["empty", 0, r`\bullet`, []],
    ["with", 2, r`{#1}, {#2}`, [r`\fenv`, r`\fdef`]]]]
]);

export let App: React.FC = (_) => (
  <Document bibtex={bibtex}>
    <ListingConfigure language={rust()} />
    <Title>Modular Program Slicing Through Ownership</Title>
    <Authors>
      <Author>
        <Name value="Will Crichton" />
        <Affiliation>
          <Institution value="Stanford University" />
        </Affiliation>
      </Author>
    </Authors>
    <Abstract>
      Program slicing, or identifying the subset of a program relevant to a
      value, relies on understanding the dataflow of a program. In languages
      with mutable pointers and functions like C or Java, tracking dataflow has
      historically required whole-program analysis, which can be be slow and
      challenging to integrate in practice. Advances in type systems have shown
      how to modularly track dataflow through the concept of ownership. We
      demonstrate that ownership can modularize program slicing by using types
      to compute a provably sound and reasonably precise approximation of
      mutation. We present an algorithm for slicing Oxide, a formalized
      ownership-based language, and prove the algorithm's soundness as a form of
      noninterference. Then we describe an implementation of the algorithm for
      the Rust programming language, and show empirically that modular slices
      are the same as whole-program slices in 95.4% of slices drawn from large
      Rust codebases.
    </Abstract>

    <$$>{r`
    \newcommand{\textsc}[1]{\text{\tiny #1}}
    \newcommand{\msf}[1]{\mathsf{#1}}
    `}</$$>
    <Oxide.Commands />

    <Section title="Introduction" name="sec:intro">
      <p>
        Program slicing is the task of identifying the subset of a program
        relevant to computing a value of interest. The concept of slicing was
        introduced 40 years ago when <Cite f v="weiser1982programmers" />{" "}
        demonstrated that programmers mentally construct slices while debugging.
        Since then, hundreds of papers have been published on implementing
        automated program slice, as surveyed by{" "}
        <Cite f v={["xu2005brief", "silva2012vocabulary"]} />. Despite these
        efforts, a review of slicers found "slicing-based debugging techniques
        are rarely used in practice" <Cite v="parnin2011automated" />
        <Footnote>
          The only open-source, functioning slicers the authors could find are
          Frama-C <Cite v="cuoq2012frama" /> and dg <Cite v="llvmslicer" />.
          Slicing tools for Java like Kaveri <Cite v="jayaraman2005kaveri" /> no
          longer work. The most industrial-strength slicing tool, CodeSurfer{" "}
          <Cite v="balakrishnan2005codesurfer" /> was GrammaTech's proprietary
          technology and appears to no longer exist.
        </Footnote>
        .
      </p>

      <p>
        A major challenge for slicing is addressing the underlying program
        analysis problems. At a high level, slicing is about dataflow --- if{" "}
        <$>x</$> is relevant, then any means by which data flows into <$>x</$>{" "}
        are also relevant. In today's programming languages, analyzing dataflow
        is difficult because of the interaction of two features: functions and
        pointers. For example, imagine slicing a value in a function <$>f</$>{" "}
        which calls a function <$>g</$>. In a language without side-effects,
        then the only relevance <$>g</$> could possibly have in <$>f</$> is its
        return value. But in a language that allows effects such as mutation on
        pointers, <$>g</$> could modify data used within <$>f</$>, requiring a
        pointer analysis. Moreover, if <$>f</$> is a higher-order function
        parameterized on <$>g</$>, then the slice must consider all the possible
        functions that <$>g</$> could be, i.e. control-flow analysis.
      </p>

      <p>
        The standard solution for analyzing programs with pointers and functions
        is <em>whole-program analysis</em>. That is, for a given function of
        interest, analyze the definitions of all of the function's callers and
        callees in the current codebase. However, whole-program analysis suffers
        from a few logistical and conceptual issues:
      </p>

      <ul>
        <li>
          <em>Analysis time scales with the size of the whole program:</em> the
          time complexity of whole-program analysis scales either polynomially
          or exponentially with the number of call sites in the program,
          depending on context-sensitivity <Cite v="might2010resolving" />. In
          practice, this means more complex codebases can take substantially
          longer to analyze. For instance, the recent PSEGPT pointer analysis
          tool <Cite v="zhao2018parallel" /> takes 1 second on a codebase of
          282,000 lines of code and 3 minutes on a codebase of 2.2 million lines
          of code.
        </li>
        <li>
          <em>
            Analysis requires access to source code for the whole program:
          </em>{" "}
          an assumption of analyzing a whole program is that a whole program is
          actually accessible. However, many programs use libraries that are
          shipped as pre-compiled objects with no source code, either for
          reasons of efficiency or intellectual property.
        </li>
        <li>
          <em>Analysis results are anti-modular:</em> when analyzing a
          particular function, relying on calling contexts to analyze the
          function's inputs means that any results are not universal.
          Calling-context-sensitive analysis determine whether two pointers
          alias <em>in the context of the broader codebase</em>, so alias
          analysis results can change due to modifications in code far away from
          the current module.
        </li>
      </ul>

      <p></p>

      <p>
        These issues are not new --- <Cite v="rountev1999data" f /> and{" "}
        <Cite v="cousot2002modular" f /> observed the same two decades ago when
        arguing for modular static analysis. The key insight arising from their
        research is that static analysis can be modularized by computing{" "}
        <em>symbolic procedure summaries</em>. For instance,{" "}
        <Cite v="yorsh2008generating" f /> show how to automatically summarize
        which inputs and outputs are possibly null for a given Java function.
        The analysis is modular because a function's summary can be computed
        only given the summaries, and not definitions, of callees in the
        function. In such prior work, the language of symbolic procedure
        summaries has been defined in a separate formal system from the
        programming language being analyzed, such as the micro-transformer
        framework of <Cite v="yorsh2008generating" f />.
      </p>

      <p>
        Our work begins with the observation:{" "}
        <em>function type signatures are symbolic procedure summaries</em>. The
        more expressive a language's type system, the more behavior that can be
        summarized by a type. Nearly all work on program slicing, dataflow
        analysis, and procedure summaries has operated on C, Java, or
        equivalents. These languages have impoverished type systems, and so any
        interesting static analysis requires a standalone abstract interpreter.
        However, if a language's type system were expressive enough to encode
        information about dataflow, then a function's type signature could be
        used to reason about the aliasing and side effects needed for slicing.
        Moreover, a function's type signature is required information for a
        compiler to export when building a library. Using the type system for
        dataflow analysis therefore obviates the logistical challenge of
        integrating an external analysis tool into a complex build system.
      </p>

      <p>
        Today, the primary technique for managing dataflow with types is{" "}
        <em>ownership</em>. Ownership is a concept that has emerged from several
        intersecting lines of research on linear logic{" "}
        <Cite v="girard1987linear" />, class-based alias management{" "}
        <Cite v="clarke1998ownership" />, and region-based memory management{" "}
        <Cite v="grossman2002region" />. Generally, ownership refers to a system
        where values are owned by an entity, which can temporarily or
        permanently transfer ownership to other entities. The type system then
        statically tracks the flow of ownership between entities.
        Ownership-based type systems enforce the invariant that values are not
        simultaneously aliased and mutated, either for the purposes of avoiding
        memory errors, data races, or abstraction violations.
      </p>

      <p>
        Our thesis is that ownership can modularize program slicing by using
        types to compute a provably sound and reasonably precise approximation
        of the necessary dataflow information. We build this thesis in five
        parts:
      </p>
      <ol>
        <li>
          We provide an intuition for the relationship between ownership and
          slicing by describing how ownership works in Rust, the only
          industrial-grade ownership-based programming language today (
          <Ref name="sec:background" />
          ).
        </li>
        <li>
          We formalize an algorithm for modular static slicing as an extension
          to the type system of Oxide <Cite v="weiss2019oxide" />, a formal
          model of Rust's static and dynamic semantics (
          <Ref name="sec:model" /> and <Ref name="sec:algorithm" />
          ).
        </li>
        <li>
          We prove the soundness of this algorithm as a form of noninterference,
          building on the connection between slicing and information flow
          established by <Cite v="abadi1999core" f /> (
          <Ref name="sec:soundness" /> and <Ref name="sec:appendix" />
          ).
        </li>
        <li>
          We describe an implementation of the slicing algorithm for Rust,
          translating the core insights of the algorithm to work on a
          lower-level control-flow graph (<Ref name="sec:implementation" />)
        </li>
        <li>
          We evaluate the precision of the modular Rust slicer against a
          whole-program slicer on a dataset of 10 codebases with a total of 280k
          LOC. We find that modular slices are the same size as whole-program
          slices 95.4% of the time, and are on average 7.6% larger in the
          remaining 4.6% of cases (<Ref name="sec:evaluation" />
          ).
        </li>
      </ol>
    </Section>

    <Section title="Principles" name="sec:background">
      <p>
        A backwards static slice is the subset of a program that could influence
        a particular value (backwards) under any possible execution (static). A
        slice is defined with respect to a slicing criterion, which is a
        variable at a particular point in a program. In this section, we provide
        an intuition for how slices interact with different features of the Rust
        programming language, namely: places (<Ref name="sec:places" />
        ), references (<Ref name="sec:pointers" />
        ), function calls (<Ref name="sec:funcalls" />
        ), and interior mutability (<Ref name="sec:intmut" />
        ).{" "}
      </p>

      <Section title="Places" name="sec:places">
        <Wrap align="right">
          <SliceListing
            code={`let mut x = 1;
let y = 2;
let z = 3;
x = y;
println!("{}", @x@);`}
          />
        </Wrap>
        <p>
          A place is a reference to a concrete piece of data in memory, like a
          variable <C>x</C> or path into a data structure <C>x.field</C>. Slices
          on places are defined by bindings, mutation, and control flow.
        </p>

        <p>
          For instance, the Rust snippet on the right shows the slice in orange
          of a place in green. The assignment <C>x = y</C> means <C>y</C> is
          relevant for the slice, so the statement <C>let y = 2</C> is relevant
          as well. Because <C>z</C> is not used in the computation of <C>x</C>,
          then <C>let z = 3</C>. is not relevant. Additionally, because{" "}
          <C>x = y</C> overwrites the previous value of <C>x</C>, then the
          original assignment <C>x = 1</C> is not relevant either.
        </p>

        <Wrap align="left">
          <SliceListing
            code={`let mut x = 1;
let mut y = 2;
if y > 0 { x = 3; } 
else     { y = 4; }
println!("{}", @x@);`}
          />
        </Wrap>

        <p>
          If a mutation is conditioned on a predicate (as in line 3 in the
          snippet on the left) then the predicate is relevant to the mutated
          place. In this example, because <C>x = 3</C> is only executed if{" "}
          <C>y &gt; 0</C>, then the value of <C>y</C> (at the time-of-check) is
          relevant to the value of <C>x</C>.
        </p>

        <p>
          Slices on composite data structures are defined by whether a mutation
          conflicts with a particular path into the data structure. For example,
          consider slicing on a tuple as in the three snippets below (note that{" "}
          <C>t.n</C> gets the <$>n</$>-th field of the tuple <C>t</C>):
        </p>

        <Row>
          <SliceListing
            code={r`let mut t = (0, 1, 2);
t = (3, 4, 5);
t.0 = 6;
t.1 = 7;
println!("{:?}", @t@);`}
          />
          <SliceListing
            code={r`let mut t = (0, 1, 2);
t = (3, 4, 5);
t.0 = 6;
t.1 = 7;
println!("{}", @t.0@);`}
          />
          <SliceListing
            code={r`let mut t = (0, 1, 2);
t = (3, 4, 5);
t.0 = 6;
t.1 = 7;
println!("{}", @t.2@);`}
          />
        </Row>

        <p>
          In this program, when slicing on <C>t</C>, changing the value of a
          field of a structure changes the value of the whole structure, so{" "}
          <C>t.1 = 7</C> is part of the slice on <C>t</C>. However, when slicing
          on <C>t.0</C>, the path <C>t.0</C> is disjoint from the path{" "}
          <C>t.1</C>, so <C>t.1 = 7</C> is not part of the slice on <C>t.0</C>.
          Similarly, when slicing on <C>t.2</C>, the only relevant assignment is{" "}
          <C>t = (3, 4, 5)</C>. More generally, a place conflicts with another
          place if either's path is a prefix of the other's. For instance,{" "}
          <C>t.0</C> conflicts with both <C>t</C> (parent) and <C>t.0.1</C>{" "}
          (child) but not <C>t.1</C> (sibling). This leads to the first slicing
          principle:
        </p>

        <Principle
          type={"places"}
          text={
            "A mutation to a place is a mutation to all conflicting places."
          }
        />

        <p>
          This principle provides an intuition for making an algorithm that
          constructs slices. For instance, take the last example above on the
          left. On line 4, when <C>t.1</C> is mutated, that mutation is
          registered as part of the slice on every conflicting place,
          specifically <C>t</C> and <C>t.1</C>.
        </p>
      </Section>

      <Section title="References" name="sec:pointers">
        <p>
          Pointers are the first major challenge for slicing. A mutation to a
          dereferenced pointer is a mutation to any place that is possibly
          pointed-to, so such places must be known to the slicer. For example:
        </p>

        <Wrap align="right">
          <SliceListing
            code={r`let mut x = 1;
let y = &mut x;
*y = 2;
let z = &x;
println!("{}", @*z@);`}
          />
        </Wrap>

        <p>
          Rust has two distinct types of pointers, which are called "references"
          to distinguish them from "raw pointers" with C-like behavior
          (discussed in <Ref name="sec:intmut" />
          ). For a given type <C>T</C>, there are immutable references of type{" "}
          <C>&T</C>, and mutable references of type <C>&mut T</C> which
          correspond respectively to the expressions <C>&x</C> and <C>&mut x</C>
          . Because <C>y</C> points to <C>x</C>, then the mutation through{" "}
          <C>y</C> is relevant to the read of <C>*z</C>. We refer to the
          left-hand side of assignment statements like <C>*y</C> as "place
          expressions", since they could include dereferences.
        </p>

        <p>
          The task of determining what a reference can point-to is called{" "}
          <em>pointer analysis</em> . While many methods exist for pointer
          analysis <Cite v="smaragdakis2015pointer" />, our first key insight is
          that Rust's ownership types implicitly perform a kind of modular
          pointer analysis that we can leverage for slicing. To understand why,
          we first need to describe two ingredients: the goal, i.e. what
          ownership is trying to accomplish, and the mechanism, i.e. how
          ownership-checking is implemented in the type system.
        </p>

        <p>
          The core goal of ownership is eliminating simultaneous aliasing and
          mutation. In Rust, achieving this goal enables the use of references
          without garbage collection while retaining memory safety. For
          instance, these three classes of errors are all caught at
          compile-time:
        </p>

        <Row>
          <Listing
            code={r`// Dangling reference
let p = {
  let x = 1; &x
};
let y = *p;`}
          />
          <Listing
            code={r`// Use-after-free
let d = tempdir();
let d2 = &d;
d.close();
let p = d2.path();`}
          />
          <Listing
            code={r`// Iterator invalidation
let mut v = vec![1,2];
for x in v.iter() {
  v.push(*x);
}`}
          />
        </Row>

        <p>
          From left-to-right: the dangling references is caught because <C>x</C>{" "}
          is deallocated at the end of scope on line 4, which is a mutation,
          conflicting with the alias <C>&x</C>. The use-after-free is caught
          because <C>d.close()</C> requires ownership of <C>d</C>, which
          prevents an alias <C>d2</C> from being live. The iterator invalidation
          case is subtler: <C>x</C> is a pointer to data within <C>v</C>.
          However, <C>v.push(*x)</C> could resize <C>v</C> which would
          copy/deallocate all vector elements to a new heap location,
          invalidating all pointers to <C>v</C>. Hence <C>v.push(*x)</C> is a
          simultaneous mutation and alias of the vector.
        </p>

        <p>
          Catching these errors requires understanding which places are pointed
          by which references. For instance, knowing that <C>x</C> points to an
          element of <C>v</C> and not just any arbitrary <C>i32</C>. The key
          mechanism behind these ownership checks is <em>lifetimes</em>.
        </p>

        <Wrap align="left">
          <Listing
            code={r`let mut x: i32 = 1;
let y: &'1 i32 = &'0 mut x;
*y = 2;
let z: &'3 i32 = &'2 x;
println!("{}", *z);`}
          />
        </Wrap>

        <p>
          Each reference expression and type has a corresponding lifetime,
          written explicitly in the syntax <C>'n</C> on the left, where <C>n</C>{" "}
          is an arbitrary and unique number. The name "lifetime" implies a model
          of lifetimes as the live range of the reference. Prior work on
          region-based memory management like <Cite f v="tofte1997region" /> and{" "}
          <Cite f v="grossman2002region" /> use this model.
        </p>

        <p>
          However, recent work from <Cite f v="polonius" /> and{" "}
          <Cite f v="weiss2019oxide" /> have devised an alternative model of
          lifetimes as "provenances" or "origins" that more directly correspond
          to a pointer analysis. In essence, a lifetime is the set of places
          that a reference could point-to. For the above example, that would be{" "}
          <C>'n = x </C> for all <C>n</C>, because each reference points to{" "}
          <C>x</C>. As a more interesting example, consider the code on the
          left.
        </p>

        <Wrap align="left">
          <Listing
            code={r`let mut x = 1;
let mut y = 2;
let z: &'2 mut i32 = if true {
  &'0 mut x
} else {
  &'1 mut y
};
let w: &'4 mut i32 = &'3 mut *z;
*w = 1;`}
          />
        </Wrap>

        <p>
          There, lifetimes for borrow expressions are assigned to the place
          being borrowed, so <C>'0 = x </C> and <C>'1 = y </C>. Because <C>z</C>{" "}
          could be assigned to either reference, then{" "}
          <C>{`'2 = '0 ∪ '1 = {x, y}`}</C>. An expression of the form{" "}
          <C>& *p</C> is called a "reborrow", as the underlying address is being
          passed from one reference to another. To register that a reference is
          reborrowed, the reborrowed place is also added to the lifetime, so{" "}
          <C>{`'3 = '4 = {x, y, *z}`}</C>. More generally:
        </p>

        <Principle
          type={"references"}
          text={
            "The lifetime of a reference contains all potential aliases of what the reference points-to."
          }
        />

        <p>
          In the context of slicing, then to determine which places could be
          modified by a particular assignment, one only needs to look up the
          aliases in the lifetime of references. For instance, <C>*w = 1</C>{" "}
          would be part of a slice on <C>*z</C>, because <C>*z</C> is in the
          lifetime <C>'4</C> of <C>w</C>.
        </p>
      </Section>

      <Section title="Function calls" name="sec:funcalls">
        <p>
          The other major challenge for slicing is function calls. For instance,
          consider slicing a call to an arbitrary function <C>f</C> with various
          kinds of inputs:
          <Footnote>
            Why is <C>String::from</C> needed? The literal <C>"Hello world"</C>{" "}
            has type <C>&'static str</C>, meaning an immutable reference to the
            binary's string pool which lives forever. The function{" "}
            <C>String::from</C> converts the immutable reference into a value of
            type <C>String</C>, which stores its contents on the heap and allows
            the string to be mutated.
          </Footnote>
        </p>

        <Wrap align="left">
          <Listing
            code={r`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{} {} {}", y, z, w);`}
          />
        </Wrap>

        <p>
          The standard approach to slicing <C>f</C> would be to inspect the
          definition of <C>f</C>, and recursively slice it by translating the
          slicing criteria from caller to callee (e.g. see{" "}
          <Cite f v="weiser1982programmers" /> for an example). However, our
          goal is to avoid using the definition of <C>f</C> (i.e. a
          whole-program analysis) for the reasons described in{" "}
          <Ref name="sec:intro" />.{" "}
        </p>

        <p>
          To modularly slice through function calls, we need to approximate the
          effects of <C>f</C> in a manner that is sound, but also as precise as
          possible. Put another way, what mutations could possibly occur as a
          result of calling <C>f</C>? Consider the three cases that arise in the
          code above.
        </p>

        <ul>
          <li>
            Passing a value <C>x</C> of type <C>String</C> (or generally of type{" "}
            <C>T</C>) moves the value into <C>f</C>. Therefore it is an
            ownership error to refer to <C>x</C> after calling <C>f</C> and we
            do not need to consider slices on <C>x</C> after <C>f</C>.
          </li>
          <li>
            Passing a value <C>y</C> of type <C>&String</C> (or <C>&T</C>)
            passes an immutable reference. Immutable references cannot be
            mutated, therefore <C>y</C> cannot change in <C>f</C>.
            <Footnote>
              A notable detail to the safety of immutable references is that
              immutability is transitive. For instance, if <C>b = &mut a</C> and{" "}
              <C>c = &b</C>, then <C>a</C> is guaranteed not to be mutated
              through <C>c</C>. This stands in contrast to other languages with
              pointers like C and C++ where the <C>const</C> keyword only
              protects values from mutation at the top-level, and not into the
              interior fields.
            </Footnote>
          </li>
          <li>
            Passing a value <C>z</C> of type <C>&mut String</C> (or{" "}
            <C>&mut T</C>) passes a mutable reference, which could possibly be
            mutated. This case is therefore the only observable of effect{" "}
            <C>f</C> apart from its return value.
          </li>
        </ul>

        <p>
          Without inspecting <C>f</C>, we cannot know how a mutable reference is
          modified, so we have to conservatively assume that every argument was
          used as input to a mutation. Therefore the modular slice of each
          variable looks as in the snippets below:
        </p>

        <Row>
          <SliceListing
            prelude={
              "let f = |x: String, y: &String, z: &mut String| -> usize { 0 };"
            }
            code={r`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{}", @y@);`}
          />
          <SliceListing
            prelude={
              "let f = |x: String, y: &String, z: &mut String| -> usize { 0 };"
            }
            code={r`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{}", @z@);`}
          />
          <SliceListing
            prelude={
              "let f = |x: String, y: &String, z: &mut String| -> usize { 0 };"
            }
            code={r`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{}", @w@);`}
          />
        </Row>

        <p>
          Note that like <C>z</C> (middle), the return value <C>w</C> (right) is
          also assumed to be influenced by every input to <C>f</C>. Implicit in
          these slices are additional assumptions about the limitations of{" "}
          <C>f</C>. For example, in C, a function could manufacture a pointer to
          the stack frame above it and mutate the values, meaning <C>f</C> could
          mutate <C>y</C> (even if <C>y</C> was not an input!). Similarly,
          functions could potentially read arbitrary data (e.g. global
          variables) that would influence mutations apart from just the
          arguments.{" "}
        </p>

        <p>
          However, allowing such pointer manipulation would easily break
          ownership safety, since fundamentally it permits unchecked aliasing.
          Hence, our principle:
        </p>

        <Principle
          type="function calls"
          text="When calling a function, (a) only mutable references in the arguments can be mutated, and (b) the mutations and return value are only influenced by the arguments."
        />

        <p>
          This principle is essentially a worst-case approximation to the
          function's effects. It is the core of how we can modularly slice
          programs, because a function's definition does not have to be
          inspected to analyze what it can mutate.{" "}
        </p>

        <p>
          A caveat to this principle is global variables: (
          <Ref name="prin:slice-procs" />
          -a) is not true with mutable globals, and (
          <Ref name="prin:slice-procs" />
          -b) is not true with read-only globals. Mutable globals are disallowed
          by the rules of ownership, as they are implicitly aliased and hence
          disallowed from being mutable. However, read-only globals are
          ownership-safe (and hence permitted in Rust). For simplicity we do not
          consider read-only globals in this work.
        </p>

        <p>
          Another notable detail is the interaction of function calls and
          lifetimes. Pointer analysis, like slicing, has historically been done
          via whole-program analysis for maximum precision. However, Rust can
          analyze lifetimes (and subsequently what references point-to)
          modularly just by looking at the type signature of a called function
          using <em>lifetime parameters</em> . Consider the function{" "}
          <C>Vec::get_mut</C> that returns a mutable reference to an element of
          a vector. For instance, <C>vec![5, 6].get_mut(0)</C> returns a mutable
          reference to the value 5. This function has the type signature:
        </p>

        <center style={{ margin: "1rem 0" }}>
          <C>{`Vec::get_mut   :   forall 'a, T . (&'a mut Vec<T>, usize) -> &'a mut T`}</C>
        </center>

        <p>
          Because this type signature is parametric in the lifetime <C>'a</C>,
          it can express the constraint that the output reference{" "}
          <C>&'a mut T</C> must have the same lifetime as the input reference{" "}
          <C>{`&'a mut Vec<T>`}</C>. Therefore the returned pointer is known to
          point to the same data as the input pointer, but without inspecting
          the definition of <C>get_mut</C>.
        </p>
      </Section>

      <Section title="Interior mutability" name="sec:intmut">
        <p>
          The previous sections describe a slicing strategy for the subset of
          Rust known as "safe Rust", that is programs which strictly adhere to
          the rules of ownership. Importantly, Rust also has the <C>unsafe</C>{" "}
          feature that gives users access to raw pointers, or pointers with
          similar unchecked behavior to C. Most commonly, <C>unsafe</C> code is
          used to implement APIs that satisfy ownership, but not in a manner
          that is deducible by the type system. For example, shared mutable
          state between threads:
        </p>

        <Wrap align="left">
          <Listing
            code={r`let value = Arc::new(Mutex::new(0));
let value_ref = value.clone();
thread::spawn(move || { 
  *value_ref.lock().unwrap() += 1; 
}).join().unwrap();
assert!(*value.lock().unwrap() == 1);`}
          />
        </Wrap>

        <p>
          In this snippet, two threads have ownership over two values of type{" "}
          <C>{`Arc<Mutex<i32>>`}</C> which internally point to the same number.
          Both threads can call <C>Mutex::lock</C> which takes an immutable
          reference to an <C>{`&Mutex<i32>`}</C> and returns a mutable reference{" "}
          <C>&mut i32</C> to the data inside.
          <Footnote>
            Technically the returned type is a{" "}
            <C>{`LockResult<MutexGuard<'a, i32>>`}</C> but the distinction isn't
            relevant here.
          </Footnote>{" "}
          This nominally violates ownership, as the data is aliased (shared by
          two threads) and mutable (both can mutate).
        </p>

        <p>
          The mutex is ownership-safe only because its implementation ensures
          that both threads cannot <em>simultaneously</em> access the underlying
          value in accordance with the system mutex's semantics. For our
          purposes, the aliasing between <C>value</C> and <C>value_ref</C> is
          not possible to observe using the type system alone. For example, in
          our algorithm, slicing on <C>value</C> would <em>not</em> include
          mutations to <C>value_ref</C>. This is because the data inside the
          mutex has type <C>*mut i32</C> (a raw pointer), and without a lifetime
          attached, our algorithm has no way to determine whether <C>value</C>{" "}
          and <C>value_ref</C> are aliases just by inspecting their types.
        </p>

        <p>
          More broadly, modular slicing is only sound for safe Rust. The point
          of this work is to say: when a program can be statically determined to
          satisfy the rules of ownership, then modular slicing is sound. The
          principles above help clarify the specific assumptions made possible
          by ownership, which are otherwise impossible to make in languages like
          C or Java. <Cite f v="astrauskas2020programmers" /> found that 76.4%
          of published Rust projects contain no unsafe code, suggesting that
          safe Rust is more common than not. However, their study does not
          account for safe Rust built on internally-unsafe abstractions like{" "}
          <C>Mutex</C>, so it is difficult to estimate the true likelihood of
          soundness in practice. We discuss the issue of slicing with unsafe
          code further in <Ref name="sec:whole-vs-mod" />.
        </p>
      </Section>
    </Section>
    <Section title="Formal Model" name="sec:model">
      <p>
        To build an algorithm from these principles, we first need a formal
        model to describe and reason about the underlying language. Rather than
        devise our own, we build on the work of <Cite f v="weiss2019oxide" /> :
        Oxide is a model of (safe) Rust's surface language with a formal static
        and dynamic semantics, along with a proof of syntactic type soundness.
        Importantly, Oxide uses a provenance model of lifetimes which we
        leverage for our slicing algorithm.{" "}
      </p>

      <p>
        We will incrementally introduce the aspects of Oxide's syntax and
        semantics as necessary to understand our principles and algorithm. We
        describe Oxide's syntax (<Ref name="sec:syn" />
        ), static semantics (<Ref name="sec:statsem" />) and dynamic semantics (
        <Ref name="sec:dynsem" />
        ), and then apply these concepts to formalize the slicing principles of
        the previous section (<Ref name="sec:formal_principles" />
        ).
      </p>

      <Section title="Syntax" name="sec:syn">
        <p>
          <Ref name="fig:oxide_syntax" /> shows a subset of Oxide's syntax along
          with a labeled example. An Oxide program consists of a set of
          functions <$>\Sigma</$> (the "global environment"), where each
          function body is an expression <$>[]</$> . The syntax is largely the
          same as Rust's with a few exceptions:
        </p>

        <Oxide.Bnf />

        <p>Here's an example expression in this custom syntax:</p>

        <$$>{r`\tysref{\provabstr{\abstrprov}}{\ownqshrd}{\tybnum}`}</$$>
      </Section>
    </Section>
  </Document>
);

ReactDOM.render(<App />, document.getElementById("container"));
