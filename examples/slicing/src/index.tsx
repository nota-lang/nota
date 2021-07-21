import React from "react";
import ReactDOM from "react-dom";
import {
  $,
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
  ListingConfigure,
} from "reactex";
import { rust } from "@codemirror/lang-rust";
import { SliceListing } from "./slicer";

// @ts-ignore
import bibtex from "./example.bib";

import "../node_modules/reactex/dist/assets.css";

const r = String.raw;
const C: React.FC = (props) => <code {...props} />;

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
    <Section title="Introduction">
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
        </li>
      </ul>

      <p>
        Calling-context-sensitive analysis determine whether two pointers alias{" "}
        <em>in the context of the broader codebase</em>, so alias analysis
        results can change due to modifications in code far away from the
        current module.
      </p>

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
          <Ref label="sec:background" />
          ).
        </li>
        <li>
          We formalize an algorithm for modular static slicing as an extension
          to the type system of Oxide <Cite v="weiss2019oxide" />, a formal
          model of Rust's static and dynamic semantics (
          <Ref label="sec:model" /> and <Ref label="sec:algorithm" />
          ).
        </li>
        <li>
          We prove the soundness of this algorithm as a form of noninterference,
          building on the connection between slicing and information flow
          established by <Cite v="abadi1999core" f /> (
          <Ref label="sec:soundness" /> and <Ref label="sec:appendix" />
          ).
        </li>
        <li>
          We describe an implementation of the slicing algorithm for Rust,
          translating the core insights of the algorithm to work on a
          lower-level control-flow graph (<Ref label="sec:implementation" />)
        </li>
        <li>
          We evaluate the precision of the modular Rust slicer against a
          whole-program slicer on a dataset of 10 codebases with a total of 280k
          LOC. We find that modular slices are the same size as whole-program
          slices 95.4% of the time, and are on average 7.6% larger in the
          remaining 4.6% of cases (<Ref label="sec:evaluation" />
          ).
        </li>
      </ol>
    </Section>

    <Section title="Principles" label="sec:background">
      <p>
        A backwards static slice is the subset of a program that could influence
        a particular value (backwards) under any possible execution (static). A
        slice is defined with respect to a slicing criterion, which is a
        variable at a particular point in a program. In this section, we provide
        an intuition for how slices interact with different features of the Rust
        programming language, namely: places (<Ref label="sec:places" />
        ), references (<Ref label="sec:pointers" />
        ), function calls (<Ref label="sec:funcalls" />
        ), and interior mutability (<Ref label="sec:intmut" />
        ).{" "}
      </p>

      <Section title="Places" label="sec:places">
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
      </Section>
    </Section>
  </Document>
);

ReactDOM.render(<App />, document.getElementById("container"));
