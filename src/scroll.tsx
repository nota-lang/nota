import {Plugin, Pluggable} from "./plugin";

// https://stackoverflow.com/questions/5353934/check-if-element-is-visible-on-screen
function checkVisible(elm: any): boolean {
  var rect = elm.getBoundingClientRect();
  var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
  return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

let get_ancestors = (el: Node): Node[] => {
  let nodes = [];
  while (el.parentNode) {
    nodes.push(el.parentNode);
    el = el.parentNode;
  }
  return nodes;
}

export let ScrollPlugin = new Plugin(class extends Pluggable {
  scroll_hooks: {[id: string]: () => void} = {};

  register_scroll_hook = (id: string, cb: () => void) => {
    this.scroll_hooks[id] = cb;
  }

  scroll_to = (anchor_id: string) => {
    let anchor_elem = document.getElementById(anchor_id)!;
    let anchor_hash = "#" + anchor_id;
  
    if (window.location.hash == anchor_hash) {
      // TODO: figure out how to make :target re-trigger in this instance
    }
  
    window.history.pushState(null, "", anchor_hash);
  
    // Hack to trigger :target
    // See: https://github.com/whatwg/html/issues/639
    window.history.pushState(null, "", "#" + anchor_hash);
    window.history.back();
  
    // Expand any containers that wrap the anchor
    let ancestors = get_ancestors(anchor_elem);
    let expanded = false;
    ancestors.forEach(node => {
      if (node instanceof HTMLElement && node.id in this.scroll_hooks) {
        this.scroll_hooks[node.id]();
        expanded = true;
      }
    });
  
    // Don't scroll if element is visible
    // See: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
    if (!expanded && checkVisible(anchor_elem)) {
      return;
    }
  
    // Effect doesn't seem to trigger immediately after history.back()?
    // TODO: bad workaround
    setTimeout(() => {
      let block: ScrollLogicalPosition =
        anchor_elem!.offsetHeight > window.innerHeight ? "start" : "center";
      anchor_elem!.scrollIntoView({
        // behavior: "smooth",
        block,
        inline: "center",
      });
    }, 100);
  }
});
