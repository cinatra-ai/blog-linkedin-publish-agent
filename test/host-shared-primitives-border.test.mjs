// The migration onto the HOST-SHARED design primitives (slice 3 of
// cinatra-ai/cinatra#3471, epic #2926): the host shares its primitives with
// extension bundles the way it already shares React — one instance, served by
// the host, never a second copy inside somebody else's package.
//
// The contract's recipe ("How a package migrates — the three lines a package
// changes") is what this file pins, for the two frozen-list copies this slice
// moves, `button` and `card`:
//
//   1. package.json — "do not declare `@cinatra-ai/design-primitives` as a
//      dependency or a peer. The id is VIRTUAL". Any specifier — an optional
//      peer included — makes the install resolve and 404.
//   2. the imports — replace every relative import of a copied primitive with
//      the BARE module id. A near-miss specifier such as the id with a
//      `/button` sub-path is refused by the same exact-tuple discipline React
//      has, so the bare id is the only form that may appear.
//   3. the copies — delete the copied file for every primitive in the frozen
//      list this slice moves.
//
// This package's renderer is source-COMPILED by the host (the contract's
// BUILD-TIME road: the host's own tsconfig path maps the id onto
// `src/lib/artifacts/host-shared-primitives.ts`), so the import line is the
// whole package-side change — there is no client renderer bundle here and
// therefore no preamble field to declare.
//
// `label` and `textarea` stay VENDORED until their own slice, so this file
// pins their copies as PRESENT: a border, not a sweep.
//
// A regression here is silent in this repository's own CI (it classifies this
// package as a source mirror and skips standalone install, typecheck and
// test), which is exactly why the copies and the copy-shaped imports are
// pinned as SOURCE facts on disk rather than left to a type error elsewhere.
//
// HOW THE COPY-SHAPED IMPORT IS DETECTED. A specifier is not matched by its
// spelling: it is RESOLVED against the file that writes it and the resulting
// path is compared with the two migrated copies. That is what catches the
// forms a spelling match misses — an explicit `.tsx` extension, a sibling
// `./button` written from inside `src/components/ui/`, a `./ui/card` written
// one level up, and the dynamic `import("...")` form. Every source extension
// this repository's own kind gate scans is walked, not only `.ts`/`.tsx`.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");
const UI_DIR = join(SRC, "components", "ui");

// The host-neutral module id the contract fixes. A plain string, never an
// import specifier of this file.
const SHARED_MODULE = "@cinatra-ai/design-primitives";

// The copies this slice moves onto the host, and the ones that stay.
const MIGRATED = ["button.tsx", "card.tsx"];
const STILL_VENDORED = ["label.tsx", "textarea.tsx"];

// The frozen-list names the renderer takes from the host module.
const TAKEN_FROM_THE_HOST = [
  "Button",
  "Card",
  "CardContent",
  "CardFooter",
  "CardHeader",
  "CardTitle",
];

// The absolute paths a copy-shaped import would resolve to, extension stripped.
const MIGRATED_TARGETS = new Set(
  MIGRATED.map((file) => join(UI_DIR, file.replace(/\.tsx$/, ""))),
);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/** Every source file under src/, in every extension the kind gate scans. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

/** Source text with its comments removed, so a commented line proves nothing. */
function withoutComments(contents) {
  return contents
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/**
 * Every relative specifier a file reaches for — the static `from "..."` form,
 * the side-effect `import "..."` form and the dynamic `import("...")` form.
 */
function relativeSpecifiers(contents) {
  const text = withoutComments(contents);
  const out = [];
  const patterns = [
    /from\s+["']([.][^"']*)["']/g,
    /import\s+["']([.][^"']*)["']/g,
    /import\s*\(\s*["']([.][^"']*)["']\s*\)/g,
    /require\s*\(\s*["']([.][^"']*)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) out.push(match[1]);
  }
  return out;
}

/** Where a relative specifier written in `file` lands, extension stripped. */
function resolveSpecifier(file, specifier) {
  const target = resolve(dirname(file), specifier);
  return target.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, "");
}

/** The named imports a file takes from the bare host-shared module id. */
function namesTakenFromTheHostModule(contents) {
  const text = withoutComments(contents);
  const pattern = new RegExp(
    "import\\s*\\{([^}]*)\\}\\s*from\\s*[\"']" + SHARED_MODULE + "[\"']",
    "g",
  );
  const statements = [...text.matchAll(pattern)];
  return statements.map((statement) =>
    statement[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      // An aliased import still takes the exported name.
      .map((name) => name.split(/\s+as\s+/)[0].trim())
      .sort(),
  );
}

describe("host-shared design primitives border (cinatra#3471 slice 3)", () => {
  it("keeps no copy of the two migrated primitives under src/components/ui/", () => {
    const remaining = existsSync(UI_DIR) ? readdirSync(UI_DIR).sort() : [];
    expect(remaining.filter((file) => MIGRATED.includes(file))).toEqual([]);
  });

  it("keeps the primitives of a later slice vendored", () => {
    const remaining = existsSync(UI_DIR) ? readdirSync(UI_DIR).sort() : [];
    for (const file of STILL_VENDORED) expect(remaining).toContain(file);
  });

  it("imports no copy of a migrated primitive from any source file", () => {
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      for (const specifier of relativeSpecifiers(readFileSync(file, "utf8"))) {
        if (MIGRATED_TARGETS.has(resolveSpecifier(file, specifier))) {
          offenders.push(relative(ROOT, file) + " -> " + specifier);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("resolves a copy-shaped specifier in every spelling the detector must catch", () => {
    // The detector is only worth its green if it fires. These are the four
    // spellings a reintroduced copy could take, checked against the resolver
    // itself rather than against a file that must not exist.
    const renderer = join(SRC, "renderers", "draft-review.tsx");
    const sibling = join(UI_DIR, "label.tsx");
    const cases = [
      [renderer, "../components/ui/button"],
      [renderer, "../components/ui/button.tsx"],
      [sibling, "./card"],
      [join(SRC, "components", "index.ts"), "./ui/card.tsx"],
    ];
    for (const [file, specifier] of cases) {
      expect(MIGRATED_TARGETS.has(resolveSpecifier(file, specifier))).toBe(true);
    }
    // And it does not fire on the copies that stay.
    expect(MIGRATED_TARGETS.has(resolveSpecifier(renderer, "../components/ui/label"))).toBe(
      false,
    );
  });

  it("takes exactly the six primitive names from the bare host-shared module id", () => {
    const renderer = readFileSync(join(SRC, "renderers", "draft-review.tsx"), "utf8");
    const statements = namesTakenFromTheHostModule(renderer);
    // ONE import statement, carrying EXACTLY the six names — not a superset
    // reached by substring, and not a second statement someone added later.
    expect(statements).toHaveLength(1);
    expect(statements[0]).toEqual([...TAKEN_FROM_THE_HOST].sort());
    // The bare id is the only form the contract admits: a sub-path specifier
    // is refused by the same exact-tuple discipline React has.
    expect(renderer).not.toContain(SHARED_MODULE + "/");
  });

  it("declares the virtual module id in no dependency field", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const declared = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ].filter((field) => Object.keys(manifest[field] ?? {}).includes(SHARED_MODULE));
    expect(declared).toEqual([]);
  });
});
