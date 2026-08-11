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
//
// Run weekly by .github/workflows/standards-corpus.yml. That is why the
// output records where it came from and at which revision, and why an
// import that changes nothing leaves the file alone: a cron that rewrites
// a timestamp every Monday would bury the real updates in noise.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Minimal TOML-subset parser: [[table]] arrays of key = "string"|bool. */
export function parseTomlBlocks(text, blockName) {
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

/** Documents + their conflict references, in the shape catalog.ts consumes. */
export function buildEntries(corpusDir) {
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

  const conflictCount = Object.values(conflictsByDocument).flat().length;
  return { entries, conflictCount };
}

function git(corpusDir, args) {
  try {
    return execFileSync("git", ["-C", corpusDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Where this import came from. A local absolute path is useless to anyone
 * else, so prefer the upstream URL and pin the exact revision — that is what
 * makes a weekly auto-import auditable rather than just fresh.
 */
export function provenance(corpusDir) {
  const remote = git(corpusDir, ["remote", "get-url", "origin"]);
  const source = remote
    ? remote.replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "")
    : corpusDir;
  return { source, revision: git(corpusDir, ["rev-parse", "HEAD"]) };
}

/** Entry-set equality — metadata (revision, timestamp) deliberately ignored. */
export function sameEntries(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function main() {
  const corpusDir =
    process.argv[2] ??
    join(process.env.HOME ?? "", "Documents/GitHub/qcvn-conflict-map");
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../src/standards/corpus.json",
  );

  const { entries, conflictCount } = buildEntries(corpusDir);
  const previous = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : null;

  // `source` is absent in files written before provenance was recorded; those
  // need one rewrite even when the entries themselves have not moved.
  if (previous?.source && sameEntries(previous.entries, entries)) {
    console.log(
      `Corpus unchanged (${entries.length} documents) — ${outPath} left as is.`,
    );
    return;
  }

  const { source, revision } = provenance(corpusDir);
  writeFileSync(
    outPath,
    `${JSON.stringify(
      { source, revision, importedAt: new Date().toISOString(), entries },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Imported ${entries.length} corpus documents, ${conflictCount} conflict ` +
      `references from ${source}@${(revision ?? "unknown").slice(0, 8)} → ${outPath}`,
  );
}

// Importable for tests; only writes when run as a script.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
