# English Summary Saver

A local, private Chrome/Edge extension (Manifest V3). It watches the ChatGPT
website and, when an assistant reply's **first visible line is exactly**
`English Summary`, it saves that one reply — unchanged — into date folders on
your computer.

It does **not** use any AI/API, does not record audio, does not rewrite or
analyse the text, and needs no backend server, Python, Node, or terminal after
installation.

You keep using ChatGPT and ChatGPT Voice normally:

```
Practise English with ChatGPT Voice
  → ask ChatGPT for the final summary
  → ChatGPT replies with a message beginning "English Summary"
  → this extension detects the finished reply
  → it saves that reply exactly as displayed
```

Files are saved as:

```
E:\桌面\english-learning\daily-summery\YYYY-MM-DD\HH-mm-ss.md
```

using your computer's **local** date and time.

---

## 1. Open the extensions page

- **Chrome:** go to `chrome://extensions`
- **Edge:** go to `edge://extensions`

(Type the address into the address bar and press Enter.)

## 2. Enable Developer Mode

- **Chrome:** turn on the **Developer mode** toggle (top-right).
- **Edge:** turn on the **Developer mode** toggle (bottom-left).

## 3. Click "Load unpacked"

A button labelled **Load unpacked** appears after Developer Mode is on.

## 4. Select the extension folder

Choose exactly:

```
E:\桌面\english-learning\daily-summery\extension
```

The extension "English Summary Saver" should now appear with no errors.

## 5. Open the extension popup

Click the extensions puzzle-piece icon in the toolbar, then click
**English Summary Saver** (pin it for convenience). The popup opens.

## 6. Choose the save folder

In the popup, click **Choose Save Folder** and select:

```
E:\桌面\english-learning\daily-summery
```

> Do **not** pick the `extension` sub-folder, and do not make a new
> `summaries` folder. Date sub-folders are created automatically **inside**
> `daily-summery`.

The browser will ask you to allow viewing and editing files in that folder —
click **Allow / Edit files**. The popup's **Permission** row should read
`granted`.

## 7. Run Test Save

Click **Test Save**. It writes and immediately deletes a tiny temporary file to
confirm the folder is writable. You should see
`Test save succeeded – folder is writable.` If not, read the error shown and
re-check the folder permission.

## 8. Test with a normal ChatGPT text conversation

1. Open `https://chatgpt.com/` in the same browser.
2. Ask ChatGPT something like: *"Reply with a message whose first line is
   exactly `English Summary`, then a few lines of notes."*
3. When ChatGPT finishes, wait ~4 seconds.
4. A green ✓ badge appears on the extension icon. Open the popup: **Last saved**
   and **File** are updated.
5. Check the folder — a new file appears under today's date, e.g.
   `daily-summery\2026-07-26\17-35-20.md`, containing exactly the reply.

To confirm the strict rule, ask ChatGPT to reply with `Daily Summary` or
`english summary` as the first line — nothing should be saved.

## 9. Test with ChatGPT Voice

1. Start a ChatGPT Voice session and practise as usual.
2. When you're done, ask (by voice or text) for the final summary and tell
   ChatGPT the reply must **begin with the line `English Summary`**.
3. ChatGPT's reply still appears as normal text in the conversation. The
   extension reads that displayed text — it never touches the audio.
4. After the reply stops changing, it is saved just like in step 8.

## 10. Why the exact title `English Summary` is required

The extension saves a reply **only** when its first non-empty visible line,
trimmed, is exactly:

```
English Summary
```

The comparison is case-sensitive and exact
(`firstNonEmptyLine.trim() === "English Summary"`). This is deliberate so that
ordinary replies are never saved. All of these are **ignored**:

- `Here is your English summary.`
- `Daily Summary`
- `English Practice Summary`
- `english summary` (wrong case)
- `Can you give me an English Summary?`
- the word "summary" appearing inside a paragraph
- Chinese titles such as `总结`

A rendered Markdown heading is fine as long as the visible first line is still
exactly `English Summary` (e.g. `# English Summary`).

The title is **hard-coded** and not configurable.

## 11. Reload the extension after changing code

If you edit any file in `extension\`:

1. Go back to `chrome://extensions` / `edge://extensions`.
2. Click the circular **Reload** icon on the English Summary Saver card.
3. Refresh any open `chatgpt.com` tab so the new `content.js` loads.

## 12. Restore folder permission

Browsers may forget folder permission after you **restart the browser**. When
that happens the popup shows **Permission: needs restore** and saving fails with
a clear error (an error `!` badge appears).

To fix it: open the popup and click **Restore Folder Permission**, then confirm
the browser prompt. If that doesn't work, click **Choose Save Folder** and pick
`daily-summery` again. Your saved-summary history and duplicate protection are
kept.

While permission is missing, the extension **does not** fall back to Downloads
and **does not** mark the summary as saved. The latest detected summary stays
available — click **Retry Latest Summary** after restoring permission.

## 13. Known limitations (if ChatGPT changes its DOM)

- The extension reads ChatGPT's page using semantic attributes, mainly
  `[data-message-author-role="assistant"]`. If ChatGPT changes this, detection
  can stop working. **All** selector logic is in one block at the top of
  `content.js` (the `SELECTORS` object) so it is easy to update.
- Completion is detected primarily by a 4-second "no more changes" debounce, so
  it does not depend on a single fragile Stop-button selector.
- Saved text is a faithful plain-text rendering of the visible message: headings
  and paragraphs on their own lines, list items prefixed with `- ` (or `1.` for
  numbered lists), blank lines between blocks. Bullets are shown as `-` because
  the on-screen bullet glyph is drawn by CSS and is not real text. No content is
  added or removed.
- Folder access uses the browser's File System Access API. A directory handle
  must be chosen once via the popup (a browser cannot silently write to an
  arbitrary Windows folder). The handle is stored in IndexedDB.
- If your browser does not support the File System Access API
  (`showDirectoryPicker`), the extension cannot save; use a current version of
  Chrome or Edge on Windows.

---

## Files

```
extension\
├── manifest.json    – MV3 manifest, permissions, content-script registration
├── content.js       – detects the summary on chatgpt.com, extracts visible text
├── background.js    – service worker: dedup hashing, status, badge, coordination
├── offscreen.html   – hidden page that hosts the file-writing code
├── offscreen.js     – writes files via the File System Access API
├── popup.html       – the popup UI
├── popup.css        – popup styles
├── popup.js         – popup logic (folder picker, permission, status, actions)
├── storage.js       – IndexedDB directory-handle helpers (shared module)
└── README.md        – this file
```

## How duplicates are prevented

For every candidate, a SHA-256 hash of `conversation URL + full reply text` is
computed. The hash is checked **before** saving and only recorded **after** a
successful write, so reloading ChatGPT or restarting the browser never creates a
second copy. The most recent 500 hashes are kept. Existing files are never
overwritten — a numeric suffix (`-2`, `-3`, …) is added if a name already
exists.
