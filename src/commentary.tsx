import React, { useContext, useEffect, useState, useRef } from "react";
import { FullWidthContainer, Row } from "./document";
import { useStateOnInterval } from "./utils";

// TODO: relate this to CSS somehow
let DOCUMENT_WIDTH = 800;

interface CommentaryProps {
  Document: React.FC<{ onLoad: () => void }>;
  comment_width: 300;
}

interface CommentaryData {
  document: React.RefObject<HTMLDivElement>;
  document_ready: boolean;
}

let CommentaryContext = React.createContext<CommentaryData | null>(null);

export let Comment: React.FC<{ selector: string }> = ({ selector, children }) => {
  let ctx = useContext(CommentaryContext);
  let [node, set_node] = useState<Element | null>(null);
  let top = useStateOnInterval(0, 1000, () => {
    if (node) {
      let container = ctx!.document.current!;
      let container_rect = container.getBoundingClientRect();
      let node_rect = node.getBoundingClientRect();
      return node_rect.top - container_rect.top;
    }
  });

  useEffect(() => {
    if (!ctx) {
      throw `Missing CommentaryContext in Comment`;
    }

    if (!ctx.document_ready) {
      return;
    }

    let container = ctx.document.current!;
    let node = container.querySelector(selector);
    if (!node) {
      console.error(container);
      throw `Missing selector "${selector}"`;
    }

    set_node(node);
  }, [selector, ctx!.document_ready]);

  return (
    <div className="comment" style={{ top }}>
      {children}
    </div>
  );
};

export let Commentary: React.FC<CommentaryProps> = ({ Document, children, comment_width }) => {
  let document_ref = useRef<HTMLDivElement>(null);
  let inner_width = DOCUMENT_WIDTH + comment_width;
  let [document_ready, set_document_ready] = useState(false);

  return (
    <CommentaryContext.Provider value={{ document: document_ref, document_ready }}>
      <FullWidthContainer
        className="commentary"
        inner_width={inner_width}
        style={{ background: "#f4f4f4" }}
      >
        <Row>
          <div ref={document_ref} className="object" style={{ width: DOCUMENT_WIDTH }}>
            <Document onLoad={() => set_document_ready(true)} />
          </div>
          <div className="comments" style={{ width: comment_width }}>
            {document_ready ? children : null}
          </div>
        </Row>
      </FullWidthContainer>
    </CommentaryContext.Provider>
  );
};
