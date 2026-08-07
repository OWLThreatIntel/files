#!/usr/bin/env node
// sanitize-world.mjs — guard against the "Error unpacking / Unterminated string
// in JSON" breakage of world.html (the bundled DC-app).
//
// world.html embeds three JSON blobs as the text of
//   <script type="__bundler/manifest">   … </script>
//   <script type="__bundler/ext_resources"> … </script>
//   <script type="__bundler/template">   … </script>
// Each blob is a single JSON line. If that JSON string contains a *literal*
// `</script>`, the browser's HTML tokenizer closes the wrapping <script> tag
// early, truncating the blob mid-string, so JSON.parse throws
// "Unterminated string in JSON at position N" and the page shows
// "Error unpacking". A correct export escapes the slash (`</script>`), which
// JSON.parse decodes back to `</script>` while hiding it from the tokenizer.
//
// A second failure mode: the data lives in a `<script type="text/x-dc">` whose
// runtime mis-parses the template when closing tags OTHER than `</script>`
// (`</title>`, `</head>`, `</div>`, …) are left literal in the blob — the page
// then renders unstyled with visible `\n` and logs "sc-for … is not an array".
// The DC export escapes EVERY `</` as `</`; a hand-built brief that only
// escaped `</script>` triggers this. So we escape all `</`, not just script.
//
// This script, run on world.html:
//   1. escapes any literal `</` -> `</` INSIDE the blob lines only (never
//      the surrounding bundler JS or the real wrapping </script> tags),
//   2. verifies all three blobs strictly JSON.parse,
//   3. decodes the `template` blob and verifies the embedded `D = { … }` data
//      object still parses as strict JSON — this catches the *double-escape*
//      failure (raw `\n`/`\"` where structure should be). That build still
//      produces a valid blob (so check 2 passes) but decodes to text the app
//      renders with literal `\n` visible everywhere, so it needs its own gate.
// Exit 0 = file is safe (possibly after an in-place fix). Exit 1 = a blob is
// corrupt beyond this fix (do NOT publish). Exit 2 = usage/IO error.

import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: sanitize-world.mjs <world.html>");
  process.exit(2);
}

let text;
try {
  text = readFileSync(path, "utf8");
} catch (e) {
  console.error(`sanitize-world: cannot read ${path}: ${e.message}`);
  process.exit(2);
}

const TAGS = ["manifest", "ext_resources", "template"];
const lines = text.split("\n");

// Locate the `D = { … }` data object inside the decoded template source and
// return its `{ … }` text via brace matching (string-aware so braces inside
// values are ignored). Anchors on the top-level `D = {` assignment so it never
// matches `const D = this.D`. Returns null if no such object is found.
function extractDataObject(src) {
  const m = src.match(/\n\s*D\s*=\s*\{/);
  if (!m) return null;
  const open = src.indexOf("{", m.index);
  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return null; // unbalanced braces
}

// Validate the decoded template's embedded data. Returns an error string if the
// data object is missing, unparseable (the double-escape signature), or not the
// expected shape; null if it is a well-formed briefing payload.
function checkTemplateData(src) {
  const objText = extractDataObject(src);
  if (!objText) return "no `D = { … }` data object found in decoded template";
  let d;
  try {
    d = JSON.parse(objText);
  } catch (e) {
    return `embedded D object is not valid JSON (${e.message})`;
  }
  for (const key of ["date", "generatedAt", "sections"]) {
    if (!(key in d)) return `embedded D object is missing "${key}"`;
  }
  return null;
}

// A blob line is the line immediately following an opening
// `<script type="__bundler/<tag>">`. Locate those lines.
const blobLineIdx = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].trim().match(/^<script type="__bundler\/([a-z_]+)">$/);
  if (m && TAGS.includes(m[1])) blobLineIdx[m[1]] = i + 1;
}

let changed = false;
let hardFail = false;

for (const tag of TAGS) {
  const idx = blobLineIdx[tag];
  if (idx === undefined || idx >= lines.length) {
    // manifest + template are mandatory; ext_resources is optional.
    if (tag === "ext_resources") continue;
    console.error(`sanitize-world: missing __bundler/${tag} blob`);
    hardFail = true;
    continue;
  }

  // 1) Escape the slash of EVERY literal `</` closing tag as `</`, exactly
  //    as the DC export does. A literal `</script` truncates the wrapping
  //    <script> in the browser tokenizer ("Error unpacking"); but the text/x-dc
  //    runtime ALSO mis-parses the template when *other* closing tags
  //    (`</title>`, `</head>`, `</div>`, …) are left literal — it mis-nests the
  //    embedded `D` object and dies with "sc-for list is not an array", leaving
  //    an unstyled page with visible `\n`. Escaping all `</` decodes back
  //    identically via JSON.parse and is idempotent (`</` has no `</`).
  const fixed = lines[idx].replace(/<\//g, "<\\u002F");
  if (fixed !== lines[idx]) {
    lines[idx] = fixed;
    changed = true;
    console.error(`sanitize-world: escaped literal </ closing tag(s) in __bundler/${tag} blob`);
  }

  // 2) The blob must strictly parse — this is what the browser will do.
  try {
    JSON.parse(lines[idx]);
  } catch (e) {
    console.error(`sanitize-world: __bundler/${tag} blob is INVALID JSON after fix: ${e.message}`);
    hardFail = true;
  }
}

// 3) Deep check: the `template` blob decodes to the app's HTML source, which
//    embeds the data as a `D = { … }` object literal (strict JSON). If the
//    export double-escaped the blob, JSON.parse still succeeds but yields text
//    where every intended newline/quote is a literal `\n` / `\"`, so the `D`
//    object no longer parses and the page renders `\n` as visible characters.
//    Re-parse D here to fail that build before it is published.
const tplIdx = blobLineIdx.template;
if (tplIdx !== undefined && tplIdx < lines.length && !hardFail) {
  let decoded;
  try {
    decoded = JSON.parse(lines[tplIdx]);
  } catch {
    decoded = null; // already reported as INVALID JSON in the loop above
  }
  if (typeof decoded === "string") {
    const err = checkTemplateData(decoded);
    if (err) {
      console.error(`sanitize-world: template blob decodes but its embedded data is corrupt: ${err}`);
      console.error("sanitize-world: this is the double-escaped-newline breakage — the page would render literal \\n. Regenerate world.html.");
      hardFail = true;
    }
  }
}

if (changed && !hardFail) {
  writeFileSync(path, lines.join("\n"));
  console.error(`sanitize-world: rewrote ${path} with escaped blob(s)`);
}

if (hardFail) process.exit(1);
process.exit(0);
