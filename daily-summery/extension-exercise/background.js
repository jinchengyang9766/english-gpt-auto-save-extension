/*
 * background.js
 *
 * This file runs in a completely different place from content.js.
 * content.js lives inside the ChatGPT page. This file lives inside the
 * extension itself, with no page and no DOM around it. There is no `document`
 * and no `window` here - trying to use them is an error.
 *
 * Its only job in this step: listen for messages and log them.
 */

// This line runs each time the service worker wakes up. It is a useful sign of
// life - if you never see it, the worker is not loading at all.
console.log("[ESS-BG] service worker started");


// TODO 8.2: listen for messages coming from content.js.
//           Call chrome.runtime.onMessage.addListener and pass it ONE callback
//           function. (Pass the function, do not call it - same rule as the
//           MutationObserver.)
//
//           The callback receives three arguments. For this step you only need
//           the first one, which is the message object content.js sent:
//
//             (message, sender, sendResponse) => { ... }
//
//           Inside the callback you should:
//             1. check that message.type is exactly "SUMMARY_DETECTED", and do
//                nothing if it is not - other messages may arrive later, and a
//                listener should only act on the kind it understands
//             2. log "[ESS-BG] SUMMARY_DETECTED received"
//             3. log how long the text is, using message.text.length - this
//                proves the text really crossed over, without flooding your
//                console with the whole summary
//
//           Do NOT call sendResponse and do NOT return anything. This step is
//           one-way only.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SUMMARY_DETECTED") {
    return;
  }

  console.log("[ESS-BG] SUMMARY_DETECTED received");
  console.log("[ESS-BG] text length:", message.text.length);

  // -------------------------------------------------------------------------
  // Step 9A: reply to the sender.
  // -------------------------------------------------------------------------

  console.log("[ESS-BG] replying");
  sendResponse({
    ok: true,
    receivedLength: message.text.length
  });

  // TODO 9A.2: send a reply back to content.js.
  //            Call sendResponse - the third parameter of this listener - with
  //            ONE argument: a plain object containing two fields:
  //              - ok: true
  //              - receivedLength: how long the text was (message.text.length)
  //
  //            Call it RIGHT HERE, directly inside the listener. Do not wrap it
  //            in setTimeout, do not make this callback async, and do not add
  //            `return true` at the end. The reply must leave before this
  //            function finishes.
  //
  //            Optional but useful: log "[ESS-BG] replying" just before you
  //            call it, so you can see the order of events in the two consoles.
  
});