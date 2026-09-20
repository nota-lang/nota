// `routes/index.tsx` is `/`. The link is a plain anchor rather than the router's base-aware
// builder on purpose: it is what the crawler follows to reach `/doc` in the default suite, and
// the base-path suite turns link crawling off and seeds its pages explicitly.
export default function Home() {
  return (
    <>
      <h1>Start fixture</h1>
      <a href="/doc">the document</a>
    </>
  );
}
