// The exact title we are looking for. Capital E, capital S, nothing else.
const REQUIRED_TITLE = "English Summary";


/**
 * Returns the first line of the element's visible text that is not blank,
 * with whitespace trimmed off both ends.
 * Returns "" if there is no such line.
 */
function firstNonEmptyLine(element) {
  const text = element.innerText;

  // TODO 1: cut `text` into an array of lines.
  //         Which character separates one line from the next?
  const lines = text.split('\n');

  // TODO 2: walk through `lines` one at a time with a for...of loop.
  //         For each line:
  //           - trim it and store the trimmed value in a variable
  //           - if that trimmed value is NOT an empty string,
  //             return it immediately (this is the answer)
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  // TODO 3: if the loop finished without finding anything,
  //         return an empty string.
  return "";
}


const messages = document.querySelectorAll(
  '[data-message-author-role="assistant"]'
);

console.log("[ESS] count:", messages.length);

messages.forEach((element, index) => {
  // TODO 4: call your function and store what it gives back.
  const firstLine = firstNonEmptyLine(element);

  // TODO 5: compare firstLine with REQUIRED_TITLE using strict equality.
  //         The result will be true or false.
  const isSummary = firstLine === REQUIRED_TITLE;

  console.log("[ESS]", index, "| first line:", firstLine, "| match:", isSummary);
});
