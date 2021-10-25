import React from "react";
import ReactDOM from "react-dom";
import * as nota from "@wcrichto/nota";

import "../css/nota-cli.scss";
import "katex/dist/katex.min.css";

//@ts-ignore
import Document from "injected-document";

// components defines the prelude of the MDX document
ReactDOM.render(<Document components={nota} />, document.getElementById("page-container"));
