import React from 'react';
import ReactDOM from 'react-dom';
import {Editor} from "./editor";
import {Viewer} from "./viewer";

import "@wcrichto/nota/dist/nota.css"
import "@wcrichto/nota-theme-acm/dist/nota-theme-acm.css"
import "../css/app.scss";

let App = () => <div>
  <div className="header">
    <h1>Nota Editor</h1>
  </div>
  <div className="panels">
    <Editor />
    <Viewer />
  </div>
</div>;

ReactDOM.render(<App />, document.getElementById('container'));
