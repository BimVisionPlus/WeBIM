// The weekly corpus import (.github/workflows/standards-corpus.yml) commits
// straight to master, so the parsing and the "nothing changed" guard are the
// only things standing between an upstream edit and the Standards module.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildEntries,
  parseTomlBlocks,
  provenance,
  sameEntries,
} from "../scripts/import-corpus.mjs";
import { corpusImportedOn } from "../src/standards/catalog";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function corpus(registry: string, conflicts: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "webim-corpus-"));
  dirs.push(dir);
  mkdirSync(join(dir, "documents"));
  mkdirSync(join(dir, "conflicts"));
  writeFileSync(join(dir, "documents/registry.toml"), registry);
  for (const [name, text] of Object.entries(conflicts)) {
    writeFileSync(join(dir, "conflicts", name), text);
  }
  return dir;
}

const REGISTRY = `
[[document]]
key = "qcvn06"
ref = "QCVN 06:2022/BXD"
title_vi = "An toàn cháy cho nhà và công trình"
kind = "qcvn"
in_force = true
edition_verified = false
note = "Ban hành TT 06/2022/TT-BXD"

[[document]]
key = "tcvn2737"
ref = "TCVN 2737:2023"
title_vi = "Tải trọng và tác động"
kind = "tcvn"
in_force = true
edition_verified = true
`;

describe("parseTomlBlocks", () => {
  it("reads only the requested table, with strings and booleans", () => {
    const blocks = parseTomlBlocks(REGISTRY, "document");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].ref).toBe("QCVN 06:2022/BXD");
    expect(blocks[0].in_force).toBe(true);
    expect(blocks[1].edition_verified).toBe(true);
  });

  it("skips multiline values instead of swallowing the rest of the block", () => {
    const text = `
[[document]]
key = "a"
description = """
key = "not-a-real-key"
"""
ref = "QCVN 1"
`;
    const [block] = parseTomlBlocks(text, "document");
    expect(block.key).toBe("a");
    expect(block.ref).toBe("QCVN 1");
    expect(block["not-a-real-key"]).toBeUndefined();
  });

  it("returns nothing for a table that is not there", () => {
    expect(parseTomlBlocks(REGISTRY, "reference")).toEqual([]);
  });
});

describe("buildEntries", () => {
  it("maps the registry into the shape the catalog consumes", () => {
    const { entries, conflictCount } = buildEntries(corpus(REGISTRY));
    expect(entries).toHaveLength(2);
    expect(conflictCount).toBe(0);
    expect(entries[0]).toMatchObject({
      key: "qcvn06",
      code: "QCVN 06:2022/BXD",
      kind: "QCVN", // upper-cased from the corpus's lowercase
      inForce: true,
      editionVerified: false,
      conflicts: [],
    });
  });

  it("attaches each conflict to every document it references", () => {
    const conflict = `
id = "CFL-001"
title_vi = "Chiều rộng lối thoát nạn"
severity = "high"

[[reference]]
document = "qcvn06"

[[reference]]
document = "tcvn2737"
`;
    const { entries, conflictCount } = buildEntries(
      corpus(REGISTRY, { "cfl-001.toml": conflict }),
    );
    expect(conflictCount).toBe(2);
    expect(entries[0].conflicts).toEqual([
      { id: "CFL-001", title: "Chiều rộng lối thoát nạn", severity: "high" },
    ]);
    expect(entries[1].conflicts[0].id).toBe("CFL-001");
  });

  it("carries the corpus's own edition_verified rather than assuming it", () => {
    const { entries } = buildEntries(corpus(REGISTRY));
    expect(entries.map((entry) => entry.editionVerified)).toEqual([false, true]);
  });

  it("ignores non-TOML files dropped in conflicts/", () => {
    const { conflictCount } = buildEntries(corpus(REGISTRY, { "README.md": "# hi" }));
    expect(conflictCount).toBe(0);
  });
});

describe("sameEntries", () => {
  it("is the guard that keeps a quiet week from producing a commit", () => {
    const { entries } = buildEntries(corpus(REGISTRY));
    const { entries: again } = buildEntries(corpus(REGISTRY));
    expect(sameEntries(entries, again)).toBe(true);

    const changed = structuredClone(entries);
    changed[0].inForce = false;
    expect(sameEntries(entries, changed)).toBe(false);
  });
});

describe("provenance", () => {
  it("falls back to the path when the corpus is not a git checkout", () => {
    const dir = corpus(REGISTRY);
    expect(provenance(dir)).toEqual({ source: dir, revision: null });
  });
});

describe("corpusImportedOn", () => {
  it("formats the import date for the Standards header", () => {
    expect(corpusImportedOn({ importedAt: "2026-08-11T05:56:10.513Z" })).toBe(
      "11/8/2026",
    );
  });

  it("says nothing rather than something wrong", () => {
    expect(corpusImportedOn({})).toBeNull();
    expect(corpusImportedOn({ importedAt: "không phải ngày" })).toBeNull();
  });
});
