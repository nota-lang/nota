// A page nothing links to: it reaches the static output only because `announceRoutes(Router)` put
// it on the crawler's hint header.
export default function Hidden() {
  return <h1>Unlinked page</h1>;
}
