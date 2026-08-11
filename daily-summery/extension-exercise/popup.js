/*
 * popup.js
 *
 * Runs when the popup opens, and is destroyed the moment the popup closes.
 * A THIRD execution context, separate from content.js and background.js.
 *
 * Unlike background.js, this one DOES have a document - popup.html is its
 * page - so document.querySelector works here.
 *
 * Its only job: read latestSummary out of storage and show it.
 */

console.log("[ESS-POPUP] popup opened");


// ---------------------------------------------------------------------------
// Step 10B, part 1: find the elements.
// ---------------------------------------------------------------------------

// TODO 10B.1: find the three elements popup.js needs to write into, and store
//             each one in a const.
//
//             Use document.querySelector("#the-id"). The `#` means "find the
//             element whose id is this". The ids in popup.html are:
//               status         - the "Loading..." line
//               saved-at       - the empty line for the timestamp
//               summary-text   - the empty box for the summary itself
//
//             Note the ids use hyphens, but a JavaScript variable name cannot
//             contain a hyphen. So name your variables something like
//             statusEl, savedAtEl, summaryTextEl.
//
const statusEl = document.querySelector("#status");
const savedAtEl = document.querySelector("#saved-at");
const summaryTextEl = document.querySelector("#summary-text");


// ---------------------------------------------------------------------------
// Step 10B, part 2: read storage and show what is there.
// ---------------------------------------------------------------------------

// TODO 10B.2: read the saved summary and display it.
//
//             Call chrome.storage.local.get("latestSummary"). Like set(), this
//             returns a Promise, so chain .then((result) => { ... }) onto it.
//
//             IMPORTANT: `result` is NOT the summary. It is a wrapper object
//             that looks like { latestSummary: {...} }. So the first thing to
//             do inside the callback is dig one level down:
//
//               const summary = result.latestSummary;
//
//             Then handle the TWO possible cases:
//
//             Case A - nothing saved yet. If `summary` is undefined (the key
//             was never written), tell the user. Set the status element's
//             .textContent to something like "No summary saved yet." and then
//             `return` so the rest does not run.
//             Tip: `if (!summary) { ... }` is true when summary is undefined.
//
//             Case B - a summary exists. Set:
//               - statusEl.textContent      to ""  (clears "Loading...")
//               - savedAtEl.textContent     to summary.savedAt
//               - summaryTextEl.textContent to summary.text
//
//             Use .textContent every time. Never .innerHTML.


// ---------------------------------------------------------------------------
// Step 10B, part 3: handle failure.
// ---------------------------------------------------------------------------

// TODO 10B.3: add .catch((error) => { ... }) to the end of the chain above,
//             the same way you did in content.js.
//             Inside it, put a readable message on screen - set the status
//             element's .textContent to something like
//             "Could not read storage: " + error.message
//             and log the error too, so it is visible in the popup console.
chrome.storage.local.get("latestSummary")
  .then((result) => {
    const summary = result.latestSummary;

    if (!summary) {
      statusEl.textContent = "No summary saved yet.";
      return;
    }

    statusEl.textContent = "";
    savedAtEl.textContent = summary.savedAt;
    summaryTextEl.textContent = summary.text;
  })
  .catch((error) => {
    statusEl.textContent = "Could not read storage: " + error.message;
    console.error("[ESS-POPUP] storage read failed:", error);
  });