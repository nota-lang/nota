import React from "react";
import ReactDOM from "react-dom";
import * as nota from "@wcrichto/nota";
import {MDXProvider} from '@mdx-js/react';

// Ordering matters here. Third-party libs first, then Nota, then Nota themes.
import "@wcrichto/nota/dist/nota.css";
import "@wcrichto/nota-theme-acm/dist/nota-theme-acm.css";
import "../css/nota-cli.scss";

//@ts-ignore
import Inner from "injected-document";

// components defines the prelude of the MDX document
ReactDOM.render(
  <MDXProvider components={nota as any}>
    <nota.Document>
      <Inner />
    </nota.Document>
  </MDXProvider>,
  document.getElementById("page-container")
);
