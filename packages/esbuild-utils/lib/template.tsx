import React from "react";

/** A server-side rendering template must accept these properties. */
export interface TemplateProps {
  /** The title of the page.
   * Should go in a <title> tag in the header. */
  title: string | string[];

  /** The description of the page.
   * Should go in a <meta> tag. */
  description?: string | string[];

  /** A URL for the Javascript that will render the page body.
   * Should go at the bottom of <body>. */
  script: string;
}

let toString = (s: string | string[]): string => (s instanceof Array ? s.join("") : s);

/** The default page template for server-side rendering. */
let Template: React.FC<React.PropsWithChildren<TemplateProps>> = ({
  title,
  description,
  script,
  children,
}) => {
  let descStr = description ? toString(description) : undefined;
  let titleStr = toString(title);
  return (
    <>
      <head>
        <link href="index.css" rel="stylesheet" />
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {descStr ? <meta name="description" content={descStr} /> : null}
        <title>{titleStr}</title>
      </head>
      <body>
        {children}
        <script src={script} type="module" async></script>
      </body>
    </>
  );
};

export default Template;
