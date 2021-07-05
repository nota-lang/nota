import './css/app.scss';

import {createContext, useContext, default as React} from 'react';
import {ReactTexContext, TexContext} from './tex';
import {ReactBibliographyContext, BibliographyContext} from './bibliography';

export {Cite} from './bibliography';
export {Tex, $} from './tex';
export {Abstract, Authors, Author, Name, Affiliation, Institution, Title} from './header';

interface DocumentData {
  sections: number
};

let DocumentContext = React.createContext<DocumentData>({sections: 0});

export let Section: React.FC = ({children}) => <section>{children}</section>

export let SectionTitle: React.FC = ({children}) => {
  let ctx = useContext(DocumentContext);
  let sec_num = ctx.sections;
  ctx.sections += 1;
  return <h2 className='section-title'>
    <span className='section-number'>{sec_num}</span> 
    {children}
  </h2>
};

export let Ref: React.FC<{label: string}> = ({label}) => {
  return <>{label}</>;
};

interface DocumentProps {
  bibtex?: string
}

export let Document: React.FC<DocumentProps> = ({children, bibtex}) => {
  let ctx = {sections: 1};
  return <DocumentContext.Provider value={ctx}>
    <ReactTexContext.Provider value={new TexContext()}>
      <ReactBibliographyContext.Provider value={new BibliographyContext(bibtex || '')}>
        <div className='document'>
          {children}
        </div>      
      </ReactBibliographyContext.Provider>
    </ReactTexContext.Provider>    
  </DocumentContext.Provider>
};