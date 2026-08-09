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
  });
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
  scan();
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
scan();