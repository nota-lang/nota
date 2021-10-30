import { codes } from "micromark-util-symbol/codes.js";
import type * as mm from "micromark-util-types";
import type * as fromMarkdown from "mdast-util-from-markdown";
import {
  markdownLineEnding,
  markdownLineEndingOrSpace,
  markdownSpace,
} from "micromark-util-character";
import { factorySpace } from "micromark-factory-space";
import { types } from "micromark-util-symbol/types.js";
import { constants } from "micromark-util-symbol/constants.js";
import { splice } from "micromark-util-chunked";
import type { Plugin } from "unified";

function labeled_header_flow(): mm.Construct {
  let resolveHeadingAtx: mm.Resolver = function (events, context) {
    let contentEnd = events.length - 2;
    let contentStart = 5; // originally 3, added 2 for enter/exit of label event
    let content: mm.Token;
    let text: mm.Token;

    // Prefix whitespace, part of the opening.
    if (events[contentStart][1].type === types.whitespace) {
      contentStart += 2;
    }

    // Suffix whitespace, part of the closing.
    if (contentEnd - 2 > contentStart && events[contentEnd][1].type === types.whitespace) {
      contentEnd -= 2;
    }

    if (
      events[contentEnd][1].type === types.atxHeadingSequence &&
      (contentStart === contentEnd - 1 ||
        (contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === types.whitespace))
    ) {
      contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
    }

    if (contentEnd > contentStart) {
      content = {
        type: types.atxHeadingText,
        start: events[contentStart][1].start,
        end: events[contentEnd][1].end,
      };
      text = {
        type: types.chunkText,
        start: events[contentStart][1].start,
        end: events[contentEnd][1].end,
        // @ts-expect-error Constants are fine to assign.
        contentType: constants.contentTypeText,
      };

      splice(events, contentStart, contentEnd - contentStart + 1, [
        ["enter", content, context],
        ["enter", text, context],
        ["exit", text, context],
        ["exit", content, context],
      ]);
    }

    return events;
  };

  let tokenizeHeadingAtx: mm.Tokenizer = function (effects, ok, nok) {
    let size = 0;

    let start: mm.State = function (code) {
      effects.enter(types.atxHeading);
      effects.enter(types.atxHeadingSequence);
      return fenceOpenInside(code);
    };

    let fenceOpenInside: mm.State = function (code) {
      if (code === codes.numberSign && size++ < constants.atxHeadingOpeningFenceSizeMax) {
        effects.consume(code);
        return fenceOpenInside;
      }

      if (code === codes.leftSquareBracket) {
        effects.exit(types.atxHeadingSequence);
        effects.consume(code);
        effects.enter("atxHeadingLabel");
        return label;
      }

      return nok(code);
    };

    let label: mm.State = function (code) {
      if (code === codes.rightSquareBracket) {
        effects.exit("atxHeadingLabel");
        effects.consume(code);
        return headingBreak;
      }

      effects.consume(code);
      return label;
    };

    let headingBreak: mm.State = function (code) {
      if (code === codes.numberSign) {
        effects.enter(types.atxHeadingSequence);
        return sequence(code);
      }

      if (code === codes.eof || markdownLineEnding(code)) {
        effects.exit(types.atxHeading);
        return ok(code);
      }

      if (markdownSpace(code)) {
        return factorySpace(effects, headingBreak, types.whitespace)(code);
      }

      effects.enter(types.atxHeadingText);
      return data(code);
    };

    let sequence: mm.State = function (code) {
      if (code === codes.numberSign) {
        effects.consume(code);
        return sequence;
      }

      effects.exit(types.atxHeadingSequence);
      return headingBreak(code);
    };

    let data: mm.State = function (code) {
      if (code === codes.eof || code === codes.numberSign || markdownLineEndingOrSpace(code)) {
        effects.exit(types.atxHeadingText);
        return headingBreak(code);
      }

      effects.consume(code);
      return data;
    };

    return start;
  };

  return {
    tokenize: tokenizeHeadingAtx,
    resolve: resolveHeadingAtx,
  };
}

function labeled_header_micromark(): mm.Extension {
  return {
    flow: { [codes.numberSign]: labeled_header_flow() },
  };
}

function labeled_header_from_markdown(): fromMarkdown.Extension {
  return {
    exit: {
      atxHeadingLabel: function (token) {
        const heading = this.stack[this.stack.length - 1];
        (heading as any).label = this.sliceSerialize(token);
      },
    },
  };
}

export let labeled_headers_plugin: Plugin = function () {
  const data: Record<string, any> = this.data();
  data.micromarkExtensions.push(labeled_header_micromark());
  data.fromMarkdownExtensions.push(labeled_header_from_markdown());
};
