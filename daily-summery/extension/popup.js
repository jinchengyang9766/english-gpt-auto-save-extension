/*
 * popup.js  (ES module)
 *
 * The popup is the ONLY place that:
 *   - opens the OS folder picker (showDirectoryPicker needs a user gesture)
 *   - re-requests permission when it has been lost (requestPermission needs a
 *     user gesture)
 * It stores the chosen handle in IndexedDB (via storage.js) and shows status.
 *
 * The actual saving is done by the background service worker + offscreen
 * document, so it works even when this popup is closed.
 */

import { saveDirHandle, getDirHandle } from "./storage.js";

const $ = (id) => document.getElementById(id);

const els = {
  folderName: $("folderName"),
  permStatus: $("permStatus"),
  chooseFolder: $("chooseFolder"),
  restorePerm: $("restorePerm"),
  autoSave: $("autoSave"),
  testSave: $("testSave"),
  retryLatest: $("retryLatest"),
  pendingNote: $("pendingNote"),
  lastSavedTime: $("lastSavedTime"),
  lastSavedFile: $("lastSavedFile"),
  savedCount: $("savedCount"),
  errorBox: $("errorBox"),
  lastError: $("lastError"),
  toast: $("toast")
};

function fmtTime(ts) {
  if (!ts) return "never";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toast(text, ok = true) {
  els.toast.textContent = text;
  els.toast.className = "toast " + (ok ? "ok" : "bad");
  setTimeout(() => els.toast.classList.add("hidden"), 3500);
}

function setPermBadge(state, folderName) {
  els.folderName.textContent = folderName || "–";
  const map = {
    granted: ["granted", "badge badge-granted"],
    prompt: ["needs restore", "badge badge-prompt"],
    denied: ["denied", "badge badge-denied"],
    none: ["no folder", "badge badge-none"],
    unknown: ["unknown", "badge badge-unknown"]
  };
  const [label, cls] = map[state] || map.unknown;
  els.permStatus.textContent = label;
  els.permStatus.className = cls;
}

async function refreshPermission() {
  let handle;
  try {
    handle = await getDirHandle();
  } catch (e) {
    setPermBadge("unknown", null);
    return null;
  }
  if (!handle) {
    setPermBadge("none", null);
    return null;
  }
  let perm = "unknown";
  try {
    perm = await handle.queryPermission({ mode: "readwrite" });
  } catch (_) {
    perm = "unknown";
  }
  setPermBadge(perm, handle.name);
  return handle;
}

async function refreshStatus() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  if (!res || !res.ok) return;
  els.autoSave.checked = !!res.settings.autoSaveEnabled;
  els.lastSavedTime.textContent = fmtTime(res.status.lastSavedTime);
  els.lastSavedFile.textContent = res.status.lastSavedFilename || "–";
  els.savedCount.textContent = String(res.savedCount || 0);
  els.pendingNote.classList.toggle("hidden", !res.hasPending);
  els.retryLatest.disabled = !res.hasPending;

  if (res.status.lastError) {
    els.lastError.textContent =
      res.status.lastError + " (" + fmtTime(res.status.lastErrorTime) + ")";
    els.errorBox.classList.remove("hidden");
  } else {
    els.errorBox.classList.add("hidden");
  }
}

async function refreshAll() {
  await Promise.all([refreshPermission(), refreshStatus()]);
}

// --- actions ---------------------------------------------------------------

els.chooseFolder.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    toast("This browser does not support the File System Access API.", false);
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({
      id: "englishSummarySaver",
      mode: "readwrite"
    });
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      toast("Read/write permission was not granted.", false);
      return;
    }
    await saveDirHandle(handle);
    await refreshAll();
    toast('Save folder set to "' + handle.name + '".');
  } catch (e) {
    if (e && e.name === "AbortError") return; // user cancelled the picker
    toast("Could not select folder: " + (e.message || e), false);
  }
});

els.restorePerm.addEventListener("click", async () => {
  const handle = await getDirHandle();
  if (!handle) {
    toast("No folder selected yet. Click “Choose Save Folder”.", false);
    return;
  }
  try {
    const perm = await handle.requestPermission({ mode: "readwrite" });
    await refreshAll();
    if (perm === "granted") toast("Folder permission restored.");
    else toast("Permission is still not granted.", false);
  } catch (e) {
    toast("Could not restore permission: " + (e.message || e), false);
  }
});

els.autoSave.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "SET_AUTOSAVE",
    enabled: els.autoSave.checked
  });
  toast(els.autoSave.checked ? "Automatic saving enabled." : "Automatic saving disabled.");
});

els.testSave.addEventListener("click", async () => {
  els.testSave.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "TEST_SAVE" });
  els.testSave.disabled = false;
  await refreshAll();
  if (res && res.ok) toast("Test save succeeded – folder is writable.");
  else toast("Test save failed: " + ((res && res.message) || "unknown"), false);
});

els.retryLatest.addEventListener("click", async () => {
  els.retryLatest.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "RETRY_LATEST" });
  await refreshAll();
  if (res && res.ok && res.duplicate) toast("That summary was already saved.");
  else if (res && res.ok) toast("Saved.");
  else toast("Retry failed: " + ((res && res.message) || "unknown"), false);
});

// Keep the popup live-ish while open.
chrome.storage.onChanged.addListener(() => refreshStatus());

refreshAll();
