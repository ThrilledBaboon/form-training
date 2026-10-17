# Assets, independence and licences

- Product name, layout, colour system, CSS barbell artwork, logo and icon: independently created for this application. No registered-trademark claim is made.
- Anatomical front/back figure: original hand-authored SVG paths in `src/components/Anatomy.tsx`. Schematic and anatomically informed; not a clinical atlas. Named regions have keyboard selection and a numerical list alternative. No third-party anatomical asset was used.
- PWA and Apple touch PNG icons: rendered from the original FORM geometry using Pillow. `public/icon.svg` is the vector source. No remote fonts, images or video are loaded.
- Interface icons: Lucide React, ISC licence. Licence is included in the installed package; attribution/source: https://lucide.dev/license .
- Exercise/muscle mappings and starter routines: independently authored general training templates, editable by the user. These mappings are approximate, not an exercise-science activation dataset.
- Reference video: privately inspected to understand desired behaviours. It is not included in the repository, production build or assets. No frame was copied into the interface.
- The supplied specification was used as product requirements. No Setgraph source code, brand, exact interface, screenshots or artwork was used. FORM is not affiliated with Setgraph.

Dependencies retain their respective licences (see package metadata and package licence files). Application code is supplied for this personal project; no third-party code licence is invented for the user. Add your preferred repository licence before publishing if you want to grant reuse rights.

## Optional local receipt OCR

`public/ocr/` vendors Tesseract.js 7.0.0, its matching Tesseract.js-core 7.0.0 LSTM
WebAssembly runtime, and the `@tesseract.js-data/eng` 1.0.0 English integer-best model.
Engine and model sources are the official project's published npm distributions; model
upstream is [naptha/tessdata](https://github.com/naptha/tessdata). Runtime source and local
hosting instructions: [Tesseract.js](https://github.com/naptha/tesseract.js) and its
[local installation guide](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).

Apache 2.0 engine and model licence texts and distribution notices are included beside the
files. `public/ocr/sources.json` records exact source URLs, SHA-256 hashes and sizes. These
files are excluded from the initial PWA precache and cached on demand. All recognition paths
are base-relative and same-origin; there are no CDN requests at runtime or uploaded receipts.
The optional model/runtime adds about 9.4 MB to the repository build. User photos remain
local database records and are never committed as application assets.
