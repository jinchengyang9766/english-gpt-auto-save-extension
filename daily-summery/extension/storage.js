/*
 * storage.js  (ES module)
 *
 * Shared helpers imported by popup.js and offscreen.js.
 *
 *  - The FileSystemDirectoryHandle for the chosen save folder is stored in
 *    IndexedDB. A directory handle is a live object and CANNOT be serialized
 *    into JSON / chrome.storage.local, so IndexedDB is required.
 *  - Small convenience wrappers around chrome.storage.local are also here.
 */

const DB_NAME = "english-summary-saver";
const DB_VERSION = 1;
const STORE = "handles";
const HANDLE_KEY = "saveDir";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTx(mode, fn) {
  return new Promise(async (resolve, reject) => {
    let db;
    try {
      db = await openDB();
    } catch (e) {
      return reject(e);
    }
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result && result.__req ? result.__req.result : result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Persist the chosen directory handle. */
export async function saveDirHandle(handle) {
  await idbTx("readwrite", (store) => {
    store.put(handle, HANDLE_KEY);
  });
}

/** Retrieve the previously chosen directory handle, or null. */
export async function getDirHandle() {
  return new Promise(async (resolve, reject) => {
    let db;
    try {
      db = await openDB();
    } catch (e) {
      return reject(e);
    }
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve(req.result || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Forget the stored directory handle. */
export async function clearDirHandle() {
  await idbTx("readwrite", (store) => {
    store.delete(HANDLE_KEY);
  });
}

// ---------------------------------------------------------------------------
// chrome.storage.local convenience wrappers
// ---------------------------------------------------------------------------

export async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

export async function setLocal(obj) {
  return chrome.storage.local.set(obj);
}
