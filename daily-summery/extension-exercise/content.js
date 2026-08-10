// The exact title we are looking for. Capital E, capital S, nothing else.
const REQUIRED_TITLE = "English Summary";

// Counts how many times the observer has called us. Purely for learning:
// it shows you how noisy ChatGPT streaming really is.
let mutationCount = 0;


/**
 * Returns the first line of the element's visible text that is not blank,
 * with whitespace trimmed off both ends.
 * Returns "" if there is no such line.
 */
function firstNonEmptyLine(element) {
  const text = element.innerText;

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}


// ---------------------------------------------------------------------------
// Step 7: remember what we have already reported (in-memory deduplication).
//
// The debounce reduced the number of scans, but every surviving scan still
// looks at EVERY message on the page. An old summary from ten minutes ago gets
// found again and again. We need a memory of "already reported".
// ---------------------------------------------------------------------------

// TODO 7.1: create the memory that holds the elements we have already
//           reported. Use `new Set()`.
//           It must live HERE, at the top level of the file - NOT inside
//           scan(). A variable created inside a function is born and dies with
//           each call, so a Set declared inside scan() would be empty again on
//           every single scan and would remember nothing.
//           Use `const`: the Set object itself is never replaced, only its
//           contents change. (This is the opposite of pendingScan, whose whole
//           value gets replaced each time.)
//
const reportedSummaries = new Set();


/**
 * Looks at every assistant message currently on the page and logs whether it
 * is an English Summary. Takes no parameters and returns nothing.
 * This is your Step 4 code, unchanged - only wrapped in a function so that it
 * can be run again and again.
 */
function scan() {
  const messages = document.querySelectorAll(
    '[data-message-author-role="assistant"]'
  );

  console.log("[ESS] count:", messages.length);

  messages.forEach((element, index) => {
    const firstLine = firstNonEmptyLine(element);

    const isSummary = firstLine === REQUIRED_TITLE;

    console.log("[ESS]", index, "| first line:", firstLine, "| match:", isSummary);

    // TODO 7.2: if this element is not a summary, there is nothing to report.
    //           Stop working on it and move on to the next element.
    //           Tip: inside a forEach callback, `return` only skips to the next
    //           item - it does not stop the whole loop.
    if (!isSummary) {
      return;
    }

    // TODO 7.3: it IS a summary, but have we already reported it?
    //           Ask your Set with .has(element). If the answer is true we have
    //           seen this exact element before, so stop here and move on.
    if (reportedSummaries.has(element)) {
      return;
    }


    // TODO 7.4: this is genuinely new. Do two things, in this order:
    //             1. add the element to your Set, so the check in 7.3 will
    //                catch it on every future scan
    //             2. log exactly: "[ESS] NEW summary detected"
    //           Adding it FIRST matters: it is the act of adding that makes
    //           this report happen only once.

    reportedSummaries.add(element);
    console.log("[ESS] NEW summary detected");

  });
}


// ---------------------------------------------------------------------------
// Step 6: debounce the scan.
//
// Step 5 proved the problem: every single mutation runs a whole scan(), and
// ChatGPT fires hundreds of mutations while it streams. A debounce says:
// "do not run yet - wait until the changes have stopped for a moment."
// ---------------------------------------------------------------------------

// How long the page must stay quiet before we actually scan.
// Short enough to feel instant, long enough to swallow a streaming burst.
// This one is already filled in for you.
const SCAN_DELAY_MS = 500;


// TODO 6.1: declare the variable that remembers the pending timer.
//           setTimeout hands back a timer ID. We must store that ID somewhere,
//           otherwise we have no way to cancel the timer later.
//           Before any timer exists there is nothing pending, so it must START
//           as null.
//           It must be `let`, not `const`, because its value gets replaced
//           every single time a new timer is created.
//
 let pendingScan = null;


/**
 * Asks for a scan to happen SCAN_DELAY_MS from now.
 * If a scan was already waiting, that older one is thrown away first, so only
 * the LAST request in a burst ever survives to run.
 */
function scheduleScan() {
  // TODO 6.2: cancel the scan that is already waiting, if there is one.
  //           Check whether your timer variable is not null. If it is not null,
  //           pass it to clearTimeout. This single step is what makes each new
  //           mutation REPLACE the previous plan instead of adding to it.
  if (pendingScan !== null) {
    clearTimeout(pendingScan);
  }

  // TODO 6.3: start a new timer, and SAVE the ID it returns into your timer
  //           variable. Use setTimeout with two arguments: a function to run
  //           later, and the delay (SCAN_DELAY_MS).
  //           Inside that function, do three things in this order:
  //             1. set your timer variable back to null - the timer has fired,
  //                so nothing is pending any more
  //             2. log something like "[ESS] debounced scan running"
  //             3. call scan()
  //           Remember: pass the function, do not call it.
  pendingScan = setTimeout(() => {
    pendingScan = null;
    console.log("[ESS] debounced scan running");
    scan();
  }, SCAN_DELAY_MS);
}


// ---------------------------------------------------------------------------
// Step 5: react to ChatGPT changing the page.
// ---------------------------------------------------------------------------

// TODO 1: choose the element to watch.
//         It must be an element that always exists and that ChatGPT never
//         replaces. If ChatGPT throws your target away, your observer is
//         watching a piece of page that is no longer on screen, and it goes
//         silent forever. The whole document body is the safe choice.
const target = document.body;


// TODO 2: build the observer with `new`.
//         Pass it ONE callback function. Remember: pass the function, do not
//         call it. The callback runs every time the page changes.
//         Inside the callback you should:
//           - increase mutationCount by 1
//           - log mutationCount so you can see how often this fires
//           - call scan()
const observer = new MutationObserver(() => {
  mutationCount++;
  console.log("[ESS] mutation count:", mutationCount);

  // TODO 6.4: this line used to be a direct `scan()` call - that is exactly the
  //           behaviour we are fixing. Replace it with a call to your new
  //           scheduling function instead, so the observer only ASKS for a
  //           scan rather than running one.

  scheduleScan();
});


// TODO 3: start the observer.
//         Call the observe method on your observer object. Give it two
//         arguments: the target from TODO 1, and an options object.
//         The options object needs three labels set to true, so that you catch
//         elements being added or removed, changes deep inside the page, and
//         text being edited in place.
observer.observe(target, {
  childList: true,
  subtree: true,
  characterData: true
});


// TODO 4: run scan() once right now, by hand.
//         The observer only tells you about FUTURE changes. If messages are
//         already on the screen when this script starts, nothing has changed
//         yet, so the callback never fires and you would see nothing at all.
//
//         Step 6 note: this one stays a DIRECT scan(), not scheduleScan().
//         There is nothing to wait for at page load, so waiting 500 ms here
//         would only add delay for no benefit.
scan();