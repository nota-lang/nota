import React from "react";

/** A server-side rendering template must accept these properties. */
export interface TemplateProps {
  /** The title of the page.
   * Should go in a <title> tag in the header. */
  title: string;

  /** A URL for the Javascript that will render the page body.
   * Should go at the bottom of <body>. */
  script: string;
}

/** The default page template for server-side rendering. */
let Template: React.FC<React.PropsWithChildren<TemplateProps>> = ({ title, script, children }) => (
  <>
    <head>
      <link href="index.css" rel="stylesheet" />
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
    </head>
    <body>
      {children}
      <script src={script} type="module"></script>
    </body>
  </>
);

export default Template;
