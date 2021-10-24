import React from 'react';
import ReactDOM from 'react-dom';
import '../css/nota-cli.scss';

//@ts-ignore
import Document from 'injected-document';

ReactDOM.hydrate(<Document />, document.getElementById('page-container'));