import React, { useState, useEffect } from "react";
import { createPopper, Instance } from "@popperjs/core";
import _ from "lodash";

import { ToplevelElem } from "./document";
import { HTMLAttributes } from "./utils";
import { Plugin, Pluggable, usePlugin } from "./plugin";
import { observer } from "mobx-react";

// TODO
// * Immediately:
//   - document weird state machine bits about flushing / being in an event
// * Long term:
//   - better architecture for this??

class TooltipData extends Pluggable {
  elts: any = {};
  queue: string[] = [];
  flushed = false;
  in_event = false;
  stateful = true;

  queue_update = (id: string) => {
    this.queue.push(id);
  };

  check_queue = () => {
    if (!_.every(this.queue, id => id in this.elts)) {
      return;
    }

    let last_el: Element | null = null;
    this.queue.forEach(id => {
      let { popperElement, referenceElement, instance, set_show } = this.elts[id];
      let ref_el = last_el === null ? referenceElement : last_el;
      instance.state.elements.reference = ref_el;
      instance.update();
      set_show(true);
      last_el = popperElement;
    });

    Object.keys(this.elts).forEach(id => {
      if (this.queue.indexOf(id) == -1) {
        this.elts[id].set_show(false);
      }
    });

    this.queue = [];
    if (this.in_event) {
      this.flushed = true;
    }
  };

  on_click = () => {
    if (!this.flushed) {
      this.check_queue();
    }

    this.flushed = false;
    this.in_event = false;
  };

  on_click_capture = () => {
    this.in_event = true;
  };

  init = () => {
    useEffect(() => {
      window.addEventListener("click", this.on_click);
      window.addEventListener("click", this.on_click_capture, true);
      return () => {
        window.removeEventListener("click", this.on_click);
        window.removeEventListener("click", this.on_click_capture, true);
      };
    }, []);
  };
}

export let TooltipPlugin: Plugin<TooltipData> = new Plugin(TooltipData);

interface TooltipProps {
  Inner: React.FC<HTMLAttributes & { ref: any }>;
  Popup: React.FC;
}

export let Tooltip = observer(({ Inner, Popup }: TooltipProps) => {
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);
  const [instance, set_instance] = useState<Instance | null>(null);

  let ctx = usePlugin(TooltipPlugin);
  let [id] = useState(_.uniqueId());
  let [stage, set_stage] = useState("start");
  let [show, set_show] = useState(false);

  let trigger = () => {
    if (stage == "start") {
      set_stage("mount");
    }
    ctx.queue_update(id);
  };

  useEffect(() => {
    if (stage == "mount" && referenceElement && popperElement) {
      set_stage("done");

      // TODO: I noticed that when embedding a document within another,
      //   the nested-document tooltips on math elements would be misaligned.
      //   Unclear why, but a fix was to use the popperjs "virtual element"
      //   feature that manually calls getBoundingClientRect(). Probably an issue
      //   with whatever their getBoundingClientRect alternative is?
      let popper_ref_el = {
        getBoundingClientRect: () => {
          let r = referenceElement.getBoundingClientRect();
          console.log(referenceElement, r);
          return r;
        },
      };
            
      let instance = createPopper(popper_ref_el, popperElement, {
        placement: "top",
        modifiers: [
          // Push tooltip farther away from content
          { name: "offset", options: { offset: [0, 10] } },

          // Add arrow
          { name: "arrow", options: { element: arrowElement } },
        ],
      });
      set_instance(instance);

      ctx.elts[id] = {
        popperElement,
        referenceElement: popper_ref_el,
        instance,
        set_show,
      };
      ctx.check_queue();
    }
  }, [stage, referenceElement, popperElement]);

  return (
    <>
      <Inner ref={setReferenceElement} onClick={trigger} />
      {stage != "start" ? (
        <ToplevelElem>
          <div
            className="tooltip"
            ref={setPopperElement}
            style={
              {
                ...(stage == "done" ? instance!.state.styles.popper : {}),
                // Have to use visibility instead of display so tooltips can
                // correctly compute position for stacking
                visibility: show ? "visible" : "hidden",
              } as any
            }
            {...(stage == "done" ? instance!.state.attributes.popper : {})}
          >
            <div
              className="arrow"
              ref={setArrowElement}
              style={{
                // Can't use visibility here b/c it messes with the special CSS for arrows
                display: show ? "block" : "none",
              }}
            />
            <Popup />
          </div>
        </ToplevelElem>
      ) : null}
    </>
  );
});
