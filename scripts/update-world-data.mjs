#!/usr/bin/env node
// update-world-data.mjs — swap the briefing payload inside the bundled world.html.
//
//   node scripts/update-world-data.mjs world.html data/latest.json
//
// world.html is a bundled DC-app: its source lives JSON-encoded on the line
// after `<script type="__bundler/template">`, and that source embeds the
// briefing as a `D = { … }` object literal. This decodes the blob, replaces the
// D object with the payload built from the JSON file, and re-encodes.
// `--dump` instead prints the current D object to stdout.

import { readFileSync, writeFileSync } from "node:fs";

const [file, dataFile] = process.argv.slice(2);
if (!file) {
  console.error("usage: update-world-data.mjs <world.html> [<news.json>|--dump]");
  process.exit(2);
}

const text = readFileSync(file, "utf8");
const lines = text.split("\n");

let tplIdx = -1;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].trim().match(/^<script type="__bundler\/([a-z_]+)">$/);
  if (m && m[1] === "template") tplIdx = i + 1;
}
if (tplIdx < 0) {
  console.error("update-world-data: no __bundler/template blob found");
  process.exit(1);
}

const src = JSON.parse(lines[tplIdx]);

// Brace-match the `D = { … }` assignment (string-aware), same anchor the
// sanitizer uses so both agree on which object is the payload.
const m = src.match(/\n\s*D\s*=\s*\{/);
if (!m) {
  console.error("update-world-data: no `D = { … }` object in decoded template");
  process.exit(1);
}
const open = src.indexOf("{", m.index);
let depth = 0, inStr = false, esc = false, close = -1;
for (let i = open; i < src.length; i++) {
  const c = src[i];
  if (esc) { esc = false; continue; }
  if (c === "\\") { esc = true; continue; }
  if (c === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (c === "{") depth++;
  else if (c === "}" && --depth === 0) { close = i + 1; break; }
}
if (close < 0) {
  console.error("update-world-data: unbalanced braces in D object");
  process.exit(1);
}

if (!dataFile || dataFile === "--dump") {
  process.stdout.write(src.slice(open, close));
  process.exit(0);
}

const news = JSON.parse(readFileSync(dataFile, "utf8"));
const payload = {
  date: news.meta.date,
  generatedAt: news.meta.generated_at,
  edition: news.meta.edition,
  sources: news.meta.sources,
  sections: news.sections,
};

const newSrc = src.slice(0, open) + JSON.stringify(payload) + src.slice(close);
lines[tplIdx] = JSON.stringify(newSrc);
writeFileSync(file, lines.join("\n"));
console.error(`update-world-data: wrote ${news.meta.date} payload into ${file}`);
