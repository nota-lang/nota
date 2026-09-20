// The start-mode root component (`src/app.tsx` is the convention). `announceRoutes` puts every
// static route on the prerender crawler's hint header, so `/hidden` — which nothing links to — is
// rendered as well.
import { announceRoutes } from "@solidjs/prerender";
import { Router } from "./router";

export default function App() {
  announceRoutes(Router);
  return <Router>{props => <main>{props.children}</main>}</Router>;
}
