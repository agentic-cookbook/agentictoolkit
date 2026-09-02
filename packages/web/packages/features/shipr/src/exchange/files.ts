/**
 * The two places a document crosses between this page and the operator's disk.
 *
 * THE BROWSER-ONLY CORNER OF THE FEATURE, kept to one small file on purpose: `document.ts`
 * and `plan.ts` are functions from data to data and are tested as such, and everything that
 * needs a `Blob`, an object URL or an `<a>` the DOM has to click for us lives here, where a
 * test can stand it in with two functions rather than emulate a download.
 */

import { DEFAULT_FILENAME, serializeDocument, type ShiprDocument } from './document';

/**
 * Hand the operator the file.
 *
 * NO SERVER ROUND TRIP. The document is built from the tree already on the screen, so a
 * download route would exist only to send bytes up and have them sent straight back — with a
 * second read of the fleet behind it that could disagree with what the operator is looking
 * at. What comes down is exactly what the console is showing.
 *
 * THE OBJECT URL IS REVOKED, and not on a timer: the blob is held alive by the URL alone, so
 * a page that forgets one leaks a whole fleet's configuration for as long as the tab lives.
 * The revoke waits for the click to have been dispatched — Safari reads the href during the
 * navigation the click starts, and revoking in the same statement has raced it.
 */
export function downloadDocument(document: ShiprDocument, filename = DEFAULT_FILENAME): void {
  const blob = new Blob([serializeDocument(document)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Attached, because a detached anchor's click is ignored by Firefox.
  anchor.style.display = 'none';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The picked file's text. `File.text()` with a `FileReader` behind it for the browsers that
 *  have the one and not the other, because a config import that silently does nothing on an
 *  older browser is worse than one that never drew a button. */
export function readTextFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('That file could not be read.'));
    reader.readAsText(file);
  });
}
