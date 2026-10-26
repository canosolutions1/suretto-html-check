# suretto-html-check

Check a page's HTML against WCAG 2.0, 2.1 and 2.2 Level A and AA rules in the browser, without running the page's scripts and without uploading anything.

This is the engine behind the free [HTML accessibility check](https://suretto.com/tools/html-check) on suretto.com, published so anyone can read how it works and run it themselves.

## What it does

- Renders pasted HTML in a sandboxed iframe (`sandbox="allow-same-origin"`, no `allow-scripts`), so none of the page's scripts or event handlers run.
- Adds a Content-Security-Policy to the HTML so its external stylesheets, images, fonts and frames are not fetched, and removes `<meta http-equiv="refresh">`.
- Runs [axe-core](https://github.com/dequelabs/axe-core) against the rendered document and returns axe's violations for the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`.

## Try it

Serve the folder with any static server and open `index.html`:

```sh
npx serve .
```

The demo loads axe-core 4.10.2 from cdnjs. To run offline, save `axe.min.js` next to the page and change `loadAxeSource` in `index.html`.

## Use it in your own page

```js
import { checkHtml } from './check-html.js';

const frame = document.querySelector('iframe[sandbox="allow-same-origin"]');
const loadAxeSource = () => fetch('/vendor/axe.min.js').then((r) => r.text());

const result = await checkHtml(frame, htmlString, { loadAxeSource });
console.log(result.violations);
```

`checkHtml` rejects input larger than 500 KB.

## Limits

Automated rules find a subset of accessibility problems. They cannot judge whether alt text is accurate, whether the focus order makes sense, or whether a screen-reader user can complete a task. Without the page's external stylesheets, colour and layout rules only see inline styles and `<style>` blocks. A clean result is not a conformance claim.

## How the engine runs inside a sandboxed frame

Scripts injected into a sandboxed frame do not run. Instead, axe-core's source is compiled once in the parent page and called with the frame's `window`, so axe reads the frame's document, computed styles and DOM constructors while the code runs in the parent. Never add `allow-scripts` to the frame: combined with `allow-same-origin`, the pasted page could remove its own sandbox.

## Licence

The code in this repository is released under the MIT licence; see [LICENSE](LICENSE).

axe-core is © Deque Systems and is licensed under the Mozilla Public License 2.0. It is loaded at runtime and is not included in this repository.

## About

Built by [Suretto](https://suretto.com), accessibility software from [Cano Solutions Private Limited](https://canosolutions.in). Suretto adds assistive-technology runs, verified fixes and evidence reports on top of automated rules.
