// Import the machine-checkable standards corpus (qcvn-conflict-map) into
// the web app's Standards module.
//
//   node scripts/import-corpus.mjs [path-to-qcvn-conflict-map]
//
// Reads documents/registry.toml + conflicts/*.toml and writes
// src/standards/corpus.json. The corpus is the long-term source of truth;
// the seed catalog fills in codes the corpus does not cover yet. The
// corpus's own honesty flag (edition_verified) is carried through — we
// never mark an entry verified unless the corpus does.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const corpusDir =
  process.argv[2] ??
  join(process.env.HOME ?? "", "Documents/GitHub/qcvn-conflict-map");
const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/standards/corpus.json",
);

/** Minimal TOML-subset parser: [[table]] arrays of key = "string"|bool. */
function parseTomlBlocks(text, blockName) {
  const blocks = [];
  let current = null;
  let inMultiline = false;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (inMultiline) {
      if (line.endsWith('"""')) inMultiline = false;
      continue;
    }
    if (line === `[[${blockName}]]`) {
      current = {};
      blocks.push(current);
      continue;
    }
    if (line.startsWith("[[") || line.startsWith("[")) {
      current = null; // some other table
      continue;
    }
    if (!current) continue;
    const match = line.match(/^([A-Za-z_]+)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (rawValue.startsWith('"""')) {
      inMultiline = !rawValue.endsWith('"""') || rawValue === '"""';
      continue;
    }
    if (rawValue.startsWith('"')) {
      current[key] = rawValue.replace(/^"|"\s*(#.*)?$/g, "");
    } else if (rawValue.startsWith("true") || rawValue.startsWith("false")) {
      current[key] = rawValue.startsWith("true");
    }
  }
  return blocks;
}

const registry = readFileSync(join(corpusDir, "documents/registry.toml"), "utf8");
const documents = parseTomlBlocks(registry, "document");

const conflictsByDocument = {};
const conflictDir = join(corpusDir, "conflicts");
for (const file of readdirSync(conflictDir).filter((f) => f.endsWith(".toml"))) {
  const text = readFileSync(join(conflictDir, file), "utf8");
  const idMatch = text.match(/^id\s*=\s*"([^"]+)"/m);
  const titleMatch = text.match(/^title_vi\s*=\s*"([^"]+)"/m);
  const severityMatch = text.match(/^severity\s*=\s*"([^"]+)"/m);
  const conflict = {
    id: idMatch?.[1] ?? file,
    title: titleMatch?.[1] ?? "",
    severity: severityMatch?.[1] ?? "",
  };
  for (const reference of parseTomlBlocks(text, "reference")) {
    if (!reference.document) continue;
    (conflictsByDocument[reference.document] ??= []).push(conflict);
  }
}

const entries = documents.map((document) => ({
  key: document.key,
  code: document.ref,
  title: document.title_vi ?? "",
  kind: (document.kind ?? "").toUpperCase(),
  inForce: document.in_force ?? true,
  editionVerified: document.edition_verified ?? false,
  note: document.note ?? null,
  conflicts: conflictsByDocument[document.key] ?? [],
}));

writeFileSync(outPath, JSON.stringify({ importedFrom: corpusDir, entries }, null, 2));
console.log(`Imported ${entries.length} corpus documents, ` +
  `${Object.values(conflictsByDocument).flat().length} conflict references → ${outPath}`);
