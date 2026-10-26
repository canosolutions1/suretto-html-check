// Runs axe-core against HTML that someone pastes, without running any of that HTML's
// scripts and without fetching anything it references.
//
// How it works
// 1. The HTML is written into <iframe sandbox="allow-same-origin" srcdoc>. Without
//    `allow-scripts` the browser runs none of the pasted page's scripts or event handlers.
//    `allow-same-origin` lets this page read the frame's DOM. Never add `allow-scripts`:
//    with both tokens the pasted page could remove its own sandbox.
// 2. A Content-Security-Policy <meta> is inserted at the top of the pasted HTML, so its
//    external stylesheets, images, fonts and frames are blocked, and any
//    <meta http-equiv="refresh"> is removed so the frame cannot navigate away.
// 3. Script elements injected into the frame would not run (the sandbox blocks them).
//    Instead, axe-core's source is compiled once in this page's realm. axe's source is a
//    function of `window`, so calling it with the frame's window makes axe read the frame's
//    document, computed styles and DOM constructors, while the code itself runs here.

export const MAX_BYTES = 500 * 1024;

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'";

let factory = null;

/**
 * Returns a function that installs axe-core into a given window.
 * `loadAxeSource` must resolve to the text of axe.min.js (for example from a bundler's
 * raw import, or `fetch('/vendor/axe.min.js').then((r) => r.text())`).
 */
async function getFactory(loadAxeSource) {
  if (factory) return factory;
  const source = await loadAxeSource();
  factory = new Function('window', source);
  return factory;
}

export function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

/** Adds the blocking CSP after any leading doctype (so the page keeps its rendering mode) and removes meta refresh. */
export function prepareHtml(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  const cleaned = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi, '<!-- meta refresh removed by the checker -->');
  const lead = cleaned.match(/^\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>/i);
  return lead ? lead[0] + meta + cleaned.slice(lead[0].length) : meta + cleaned;
}

function loadFrame(frame, html) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The page took too long to render.')), 15000);
    frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
    frame.srcdoc = html;
  });
}

/**
 * Renders `html` in the sandboxed `frame` and returns axe's results for WCAG 2.0, 2.1 and 2.2
 * Level A and AA rules. `frame` must be an <iframe sandbox="allow-same-origin"> in the page.
 */
export async function checkHtml(frame, html, { loadAxeSource }) {
  if (byteLength(html) > MAX_BYTES) throw new Error('The HTML is larger than 500 KB.');
  const install = await getFactory(loadAxeSource);
  await loadFrame(frame, prepareHtml(html));
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) throw new Error('The rendered page could not be read.');
  // Size the frame to its content so every element has real layout for contrast and target-size rules.
  const height = Math.min(Math.max(doc.documentElement.scrollHeight, 240), 6000);
  frame.style.height = `${height}px`;
  install(win);
  if (!win.axe) throw new Error('The rules engine did not start.');
  return win.axe.run(doc, {
    runOnly: { type: 'tag', values: WCAG_TAGS },
    resultTypes: ['violations'],
    iframes: false, // nested frames cannot run axe; they are blocked by the CSP anyway
    preload: false, // axe would otherwise try to fetch the page's stylesheets
    elementRef: false,
  });
}
