import { Instance, VirtualElement, createPopper } from "@popperjs/core";
import _ from "lodash";
import React, { useEffect, useState } from "react";

import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { ToplevelElem } from "./portal.js";
import {
  Container,
  HTMLAttributes,
  ReactConstructor,
  ReactNode,
  getOrRender,
  isConstructor,
} from "./utils.js";

// TODO
// * Immediately:
//   - document weird state machine bits about flushing / being in an event
// * Long term:
//   - better architecture for this??

class TooltipData extends Pluggable {
  elts: {
    [id: string]: {
      popperElement: HTMLElement;
      referenceElement: HTMLElement | VirtualElement;
      instance: Instance;
      setShow: (show: boolean) => void;
    };
  } = {};
  queue: string[] = [];
  flushed = false;
  inEvent = false;
  stateful = true;

  queueUpdate = (id: string) => {
    this.queue.push(id);
  };

  checkQueue = async () => {
    if (!_.every(this.queue, id => id in this.elts)) {
      return;
    }

    let lastEl: Element | null = null;
    for (let id of this.queue) {
      let { popperElement, referenceElement, instance, setShow } = this.elts[id];
      let refEl = lastEl === null ? referenceElement : lastEl;

      // TODO: double update is needed or else arrow doesn't get correctly positioned?
      // not sure why
      await instance.update();
      instance.state.elements.reference = refEl;
      await instance.update();

      setShow(true);
      lastEl = popperElement;
    }

    Object.keys(this.elts).forEach(id => {
      if (this.queue.indexOf(id) == -1) {
        this.elts[id].setShow(false);
      }
    });

    this.queue = [];
    if (this.inEvent) {
      this.flushed = true;
    }
  };

  onClick = async () => {
    if (!this.flushed) {
      await this.checkQueue();
    }

    this.flushed = false;
    this.inEvent = false;
  };

  onClickCapture = () => {
    this.inEvent = true;
  };

  init = () => {
    useEffect(() => {
      window.addEventListener("click", this.onClick);
      window.addEventListener("click", this.onClickCapture, true);
      window.addEventListener("touchend", this.onClick);
      window.addEventListener("touchend", this.onClickCapture, true);
      return () => {
        window.removeEventListener("click", this.onClick);
        window.removeEventListener("click", this.onClickCapture, true);
        window.removeEventListener("touchend", this.onClick);
        window.removeEventListener("touchend", this.onClickCapture, true);
      };
    }, []);
  };
}

export let TooltipPlugin: Plugin<TooltipData> = new Plugin(TooltipData);

interface TooltipChildProps {
  ref: React.Ref<any>;
  onClick: HTMLAttributes["onClick"];
}

interface TooltipProps {
  children: ReactConstructor<TooltipChildProps> | ReactNode;
  Popup: ReactConstructor | ReactNode;
}

export let Tooltip: React.FC<TooltipProps> = ({ children: Inner, Popup }) => {
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);

  let ctx = usePlugin(TooltipPlugin);
  let [id] = useState(_.uniqueId());
  let [stage, setStage] = useState<"start" | "mount" | "done">("start");
  let [show, setShow] = useState(false);

  let trigger: React.MouseEventHandler = e => {
    e.preventDefault();

    if (show) {
      setShow(false);
    } else {
      if (stage == "start") {
        setStage("mount");
      }
      ctx.queueUpdate(id);
    }
  };

  useEffect(() => {
    (async () => {
      if (stage == "mount" && referenceElement && popperElement) {
        setStage("done");

        // TODO: I noticed that when embedding a document within another,
        //   the nested-document tooltips on math elements would be misaligned.
        //   Unclear why, but a fix was to use the popperjs "virtual element"
        //   feature that manually calls getBoundingClientRect(). Probably an issue
        //   with whatever their getBoundingClientRect alternative is?
        let popperRefEl = {
          getBoundingClientRect: () => referenceElement.getBoundingClientRect(),
        };

        let instance = createPopper(popperRefEl, popperElement, {
          placement: "top",
          modifiers: [
            // Push tooltip farther away from content
            { name: "offset", options: { offset: [0, 10] } },

            // Add arrow
            { name: "arrow", options: { element: arrowElement } },
          ],
        });
        setInstance(instance);

        ctx.elts[id] = {
          popperElement,
          referenceElement: popperRefEl,
          instance,
          setShow,
        };
        await ctx.checkQueue();
      }
    })();
  }, [stage, referenceElement, popperElement]);

  let inner = isConstructor<TooltipChildProps>(Inner) ? (
    <Inner ref={setReferenceElement} onClick={trigger} />
  ) : (
    <Container ref={setReferenceElement} onClick={trigger}>
      {Inner}
    </Container>
  );

  return (
    <>
      {inner}
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
            {getOrRender(Popup, {})}
          </div>
        </ToplevelElem>
      ) : null}
    </>
  );
};
