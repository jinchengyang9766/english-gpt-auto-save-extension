/*
 * offscreen.js  (ES module, runs in offscreen.html)
 *
 * Performs the actual file writes. It retrieves the FileSystemDirectoryHandle
 * that the popup stored in IndexedDB, verifies permission, creates the local
 * date folder, avoids overwriting, and writes the summary as UTF-8.
 *
 * It writes the text EXACTLY as received from content.js. Nothing here inspects,
 * classifies, rewrites, or adds to the content.
 */

import { getDirHandle } from "./storage.js";

// --- date / time helpers (LOCAL time, not UTC) -----------------------------
function pad2(n) {
  return String(n).padStart(2, "0");
}
function localParts(d) {
  return {
    folder: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    base: `${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`
  };
}

async function fileExists(dirHandle, name) {
  try {
    await dirHandle.getFileHandle(name, { create: false });
    return true;
  } catch (e) {
    return false; // NotFoundError -> does not exist
  }
}

// Find a non-clashing name: HH-mm-ss.md, HH-mm-ss-2.md, HH-mm-ss-3.md ...
async function uniqueName(dirHandle, base) {
  let name = `${base}.md`;
  let i = 2;
  while (await fileExists(dirHandle, name)) {
    name = `${base}-${i}.md`;
    i++;
  }
  return name;
}

async function requireGrantedHandle() {
  const handle = await getDirHandle();
  if (!handle) {
    const err = new Error("No save folder is selected yet. Open the popup and click “Choose Save Folder”.");
    err.code = "NO_FOLDER";
    throw err;
  }
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") {
    // We cannot re-request here (no user gesture in an offscreen document).
    chrome.runtime.sendMessage({ type: "PERMISSION_WARNING" });
    const err = new Error(
      "Folder permission is not granted. Open the popup and click “Restore Folder Permission”."
    );
    err.code = "PERMISSION_LOST";
    throw err;
  }
  return handle;
}

async function writeSummary(text) {
  const root = await requireGrantedHandle();
  const now = new Date();
  const { folder, base } = localParts(now);

  const dateDir = await root.getDirectoryHandle(folder, { create: true });
  const name = await uniqueName(dateDir, base);

  const fileHandle = await dateDir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  // A UTF-8 string Blob; File System Access writes it as UTF-8 bytes.
  await writable.write(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  await writable.close();

  return { ok: true, folder, filename: name };
}

// Validate the whole path (permission + mkdir + write + delete) without leaving
// a stray file behind.
async function testWrite() {
  const root = await requireGrantedHandle();
  const now = new Date();
  const { folder } = localParts(now);
  const dateDir = await root.getDirectoryHandle(folder, { create: true });

  const testName = `.__summary_saver_test__.tmp`;
  const fileHandle = await dateDir.getFileHandle(testName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob(["English Summary Saver test write."], { type: "text/plain" }));
  await writable.close();
  // Clean up so no junk file is left in the date folder.
  try {
    await dateDir.removeEntry(testName);
  } catch (_) {
    /* if removal fails the write itself still succeeded */
  }
  return { ok: true, folder };
}

// --- message handling -------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen") return; // only handle our own messages

  const run = async () => {
    if (msg.cmd === "SAVE") return writeSummary(msg.text);
    if (msg.cmd === "TEST") return testWrite();
    return { ok: false, code: "UNKNOWN", message: "Unknown offscreen command." };
  };

  run()
    .then((r) => sendResponse(r))
    .catch((e) =>
      sendResponse({
        ok: false,
        code: e && e.code ? e.code : "ERR",
        message: String(e && e.message ? e.message : e)
      })
    );
  return true; // async response
});
