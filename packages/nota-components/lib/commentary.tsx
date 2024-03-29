import React, { useCallback, useContext, useEffect, useRef, useState } from "react";

import { FullWidthContainer, Row } from "./document.js";
import { FCC, useStateOnInterval } from "./utils.js";

// TODO: relate this to CSS somehow
let DOCUMENT_WIDTH = 800;

interface CommentaryProps {
  Document: React.FC<{ onRender: () => void }>;
  commentWidth: 300;
}

interface CommentaryData {
  document: React.RefObject<HTMLDivElement>;
  documentReady: boolean;
}

let CommentaryContext = React.createContext<CommentaryData | null>(null);

export let Comment: FCC<{ selector: string }> = ({ selector, children }) => {
  let ctx = useContext(CommentaryContext);
  let [node, setNode] = useState<Element | null>(null);
  let top = useStateOnInterval(0, 1000, () => {
    if (node) {
      let container = ctx!.document.current!;
      let containerRect = container.getBoundingClientRect();
      let nodeRect = node.getBoundingClientRect();
      return nodeRect.top - containerRect.top;
    }
  });

  useEffect(() => {
    if (!ctx) {
      throw new Error(`Missing CommentaryContext in Comment`);
    }

    if (!ctx.documentReady) {
      return;
    }

    let container = ctx.document.current!;
    let node = container.querySelector(selector);
    if (!node) {
      console.error(container);
      throw new Error(`Missing selector "${selector}"`);
    }

    setNode(node);
  }, [selector, ctx!.documentReady]);

  return (
    <div className="comment" style={{ top }}>
      {children}
    </div>
  );
};

export let Commentary: FCC<CommentaryProps> = ({ Document, children, commentWidth }) => {
  let documentRef = useRef<HTMLDivElement>(null);
  let [documentReady, setDocumentReady] = useState(false);

  return (
    <CommentaryContext.Provider value={{ document: documentRef, documentReady: documentReady }}>
      <FullWidthContainer
        className="commentary"
        style={{ background: "#f4f4f4", padding: "1rem 0" }}
      >
        <Row>
          <div ref={documentRef} className="object" style={{ width: DOCUMENT_WIDTH }}>
            <Document onRender={useCallback(() => setDocumentReady(true), [])} />
          </div>
          <div className="comments" style={{ width: commentWidth }}>
            {documentReady ? children : null}
          </div>
        </Row>
      </FullWidthContainer>
    </CommentaryContext.Provider>
  );
};
