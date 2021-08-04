import React, { useEffect, useRef } from "react";
import CodeMirror from "react-codemirror";

import "../node_modules/codemirror/lib/codemirror.css";
import "codemirror/mode/jsx/jsx";

export let TsxViewer: React.FC<{ code: string; width?: number; height?: number }> = ({
  code,
  width,
  height,
}) => {
  let ref = useRef<any>(null);
  useEffect(() => {
    let cm = ref.current!.getCodeMirror();
    let rect = cm.getWrapperElement().querySelector('.CodeMirror-sizer').getBoundingClientRect();
    cm.setSize(width || rect.width, height || rect.height);
  }, []);

  return (
    <>
    <style>{`
    .CodeMirror { font-size: 16px; font-family: Inconsolata; }
    .CodeMirror-gutters { background: none; border: none; padding-right: 5px; }
    .CodeMirror-linenumber { font-size: 12px; position: relative; top: 2px; }      
    `}</style>
    <CodeMirror
      value={code}
      ref={ref}
      options={{
        mode: {name: "jsx", base: {name: "javascript", typescript: true}},
        lineNumbers: true,
        readOnly: true
      }}
    />
    </>
  );
};
