/*
 * content.js
 * Runs only on https://chatgpt.com/*  (see manifest.json).
 *
 * Responsibility:
 *   1. Watch the conversation for assistant messages.
 *   2. Save a message ONLY when its first non-empty visible line is exactly
 *      "English Summary" (case-sensitive, exact).
 *   3. Wait until that message has stopped changing (streaming finished),
 *      using a 4 second text-change debounce as the primary completion signal.
 *   4. Extract the message's rendered visible text and send it to the
 *      background service worker to be written to disk.
 *
 * This script does NOT: call any AI/API, analyse/rewrite the summary, or save
 * the whole conversation. It only reads the text that ChatGPT already displays.
 */

(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Hard-coded detection rule. Do NOT make this configurable.
  // ---------------------------------------------------------------------------
  const REQUIRED_TITLE = "English Summary";

  // Wait this long after the LAST content change before treating the message as
  // finished. This debounce is the main completion signal.
  const DEBOUNCE_MS = 4000;

  // If the debounce fires but ChatGPT still looks like it is generating, we wait
  // a little more and re-check.
  const RECHECK_MS = 1500;

  // ---------------------------------------------------------------------------
  // ALL ChatGPT DOM knowledge lives here. If ChatGPT changes its HTML, this is
  // the only block you need to update. We deliberately rely on semantic
  // attributes and avoid generated / deeply-nested CSS class names.
  // ---------------------------------------------------------------------------
  const SELECTORS = {
    // A single assistant turn.
    assistantMessage: '[data-message-author-role="assistant"]',
    // The rendered content container inside an assistant message. We try these
    // in order and fall back to the message element itself. These class names
    // are best-effort; the assistant message element is the reliable anchor.
    contentRoots: [".markdown", ".prose"],
    // The scroll/conversation container we observe (falls back to body).
    conversationRoot: "main",
    // Any of these present anywhere means ChatGPT still appears to be generating.
    streamingIndicators: [
      ".result-streaming",
      '[data-testid="stop-button"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label*="Stop"]'
    ]
  };

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function getContentNode(messageEl) {
    for (const sel of SELECTORS.contentRoots) {
      const found = messageEl.querySelector(sel);
      if (found) return found;
    }
    return messageEl;
  }

  function isHidden(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.getAttribute("aria-hidden") === "true") return true;
    if (el.hasAttribute("hidden")) return true;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    return style.display === "none" || style.visibility === "hidden";
  }

  function isStreaming() {
    for (const sel of SELECTORS.streamingIndicators) {
      if (document.querySelector(sel)) return true;
    }
    return false;
  }

  // First non-empty visible line of a node, trimmed. Used for the strict check.
  function firstNonEmptyLine(node) {
    const text = node.innerText || "";
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.trim() !== "") return line.trim();
    }
    return "";
  }

  // ---------------------------------------------------------------------------
  // Visible-text extraction.
  //
  // Produces a faithful, plain-text version of what the user sees: headings and
  // paragraphs on their own lines, list items prefixed with a marker, blank
  // lines between blocks. It reads only the message content node, so interface
  // buttons (copy / rate / read-aloud / voice) that live outside the content are
  // never included. Nothing is analysed, classified, rewritten, or added.
  // ---------------------------------------------------------------------------

  const SKIP_TAGS = new Set(["BUTTON", "SVG", "STYLE", "SCRIPT", "NOSCRIPT"]);

  function renderInline(el) {
    let buf = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        buf += n.nodeValue;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        if (SKIP_TAGS.has(n.tagName) || isHidden(n)) return;
        if (n.tagName === "BR") buf += "\n";
        else buf += renderInline(n);
      }
    });
    return buf;
  }

  function collapseInline(s) {
    // Collapse runs of spaces/tabs but keep explicit newlines from <br>.
    return s
      .split("\n")
      .map((part) => part.replace(/[ \t ]+/g, " ").trim())
      .join("\n")
      .trim();
  }

  function extractVisibleText(root) {
    const lines = [];
    const push = (t) => lines.push(t);

    function walk(el, depth) {
      el.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n.nodeValue.replace(/[ \t ]+/g, " ").trim();
          if (t) push(t);
          return;
        }
        if (n.nodeType !== Node.ELEMENT_NODE) return;
        if (SKIP_TAGS.has(n.tagName) || isHidden(n)) return;

        const tag = n.tagName;

        if (/^H[1-6]$/.test(tag)) {
          const t = collapseInline(renderInline(n));
          if (t) push(t);
          push(""); // blank line after a heading
        } else if (tag === "P") {
          const t = collapseInline(renderInline(n));
          if (t) push(t);
          push("");
        } else if (tag === "UL" || tag === "OL") {
          walk(n, depth); // LI children handled below
          push("");
        } else if (tag === "LI") {
          const parent = n.parentElement;
          let marker = "- ";
          if (parent && parent.tagName === "OL") {
            const idx = Array.prototype.indexOf.call(parent.children, n) + 1;
            marker = idx + ". ";
          }
          // Inline part of this LI, excluding any nested lists.
          let inline = "";
          const nested = [];
          n.childNodes.forEach((c) => {
            if (
              c.nodeType === Node.ELEMENT_NODE &&
              (c.tagName === "UL" || c.tagName === "OL")
            ) {
              nested.push(c);
            } else if (c.nodeType === Node.TEXT_NODE) {
              inline += c.nodeValue;
            } else if (c.nodeType === Node.ELEMENT_NODE) {
              if (SKIP_TAGS.has(c.tagName) || isHidden(c)) return;
              inline += c.tagName === "BR" ? "\n" : renderInline(c);
            }
          });
          const indent = "  ".repeat(depth);
          const text = collapseInline(inline);
          if (text) {
            const parts = text.split("\n");
            push(indent + marker + parts[0]);
            for (let i = 1; i < parts.length; i++) {
              push(indent + "  " + parts[i]);
            }
          }
          nested.forEach((ns) => walk(ns, depth + 1));
        } else if (tag === "PRE") {
          const codeEl = n.querySelector("code");
          const code = ((codeEl || n).innerText || "").replace(/\n+$/, "");
          if (code) push(code);
          push("");
        } else if (tag === "BLOCKQUOTE") {
          walk(n, depth);
        } else if (tag === "TABLE") {
          n.querySelectorAll("tr").forEach((tr) => {
            const cells = Array.from(tr.children).map((td) =>
              collapseInline(renderInline(td)).replace(/\n/g, " ")
            );
            push(cells.join(" | "));
          });
          push("");
        } else if (tag === "HR") {
          push("---");
          push("");
        } else if (tag === "BR") {
          push("");
        } else {
          // Generic container: recurse if it holds block children, else treat
          // its whole content as one inline line.
          const hasBlockChild = Array.from(n.children).some((c) =>
            /^(P|DIV|UL|OL|LI|H[1-6]|PRE|BLOCKQUOTE|TABLE|HR)$/.test(c.tagName)
          );
          if (hasBlockChild) {
            walk(n, depth);
          } else {
            const t = collapseInline(renderInline(n));
            if (t) push(t);
          }
        }
      });
    }

    walk(root, 0);

    let text = lines.join("\n");
    // Tidy: never more than one blank line in a row; trim trailing spaces and
    // the leading/trailing blank lines. This removes only whitespace noise, not
    // any visible content.
    text = text
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");
    return text;
  }

  // ---------------------------------------------------------------------------
  // Detection + completion (debounce) state machine.
  // ---------------------------------------------------------------------------

  // messageEl -> { text, timer, finalized }
  const state = new Map();

  function scheduleFinalize(el) {
    const s = state.get(el);
    if (!s) return;
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => maybeFinalize(el), DEBOUNCE_MS);
  }

  function maybeFinalize(el) {
    const s = state.get(el);
    if (!s || s.finalized) return;
    if (!el.isConnected) {
      state.delete(el);
      return;
    }

    // Secondary safety: if ChatGPT still looks like it's generating, keep waiting.
    if (isStreaming()) {
      s.timer = setTimeout(() => maybeFinalize(el), RECHECK_MS);
      return;
    }

    const content = getContentNode(el);

    // Re-confirm the strict title still holds at the moment of saving.
    if (firstNonEmptyLine(content) !== REQUIRED_TITLE) {
      state.delete(el);
      return;
    }

    const text = extractVisibleText(content);

    // If content changed since the timer was set, restart the debounce.
    if (text !== s.text) {
      s.text = text;
      s.timer = setTimeout(() => maybeFinalize(el), DEBOUNCE_MS);
      return;
    }

    s.finalized = true;
    sendSummary(text);
  }

  function sendSummary(text) {
    try {
      chrome.runtime.sendMessage(
        { type: "SUMMARY_DETECTED", url: location.href, text },
        () => void chrome.runtime.lastError // swallow "no receiver" noise
      );
    } catch (_) {
      /* extension context may be reloading; ignore */
    }
  }

  function scanOnce() {
    const messages = document.querySelectorAll(SELECTORS.assistantMessage);
    messages.forEach((el) => {
      const content = getContentNode(el);
      const matches = firstNonEmptyLine(content) === REQUIRED_TITLE;

      if (!matches) {
        // No longer a candidate: drop any pending timer.
        const s = state.get(el);
        if (s) {
          if (s.timer) clearTimeout(s.timer);
          state.delete(el);
        }
        return;
      }

      const text = extractVisibleText(content);
      let s = state.get(el);
      if (!s) {
        s = { text, timer: null, finalized: false };
        state.set(el, s);
        scheduleFinalize(el);
        return;
      }
      if (s.finalized && s.text === text) return; // already saved, unchanged
      if (s.text !== text) {
        s.text = text;
        s.finalized = false; // content changed again -> not final
        scheduleFinalize(el);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Observe the conversation. A single throttled scan handles all mutations.
  // ---------------------------------------------------------------------------
  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      try {
        scanOnce();
      } catch (e) {
        /* keep the observer alive even if one scan throws */
      }
    }, 250);
  }

  function start() {
    const root =
      document.querySelector(SELECTORS.conversationRoot) || document.body;
    const observer = new MutationObserver(queueScan);
    observer.observe(root === document.body ? document.body : document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    // Initial pass in case a summary is already on screen.
    queueScan();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
