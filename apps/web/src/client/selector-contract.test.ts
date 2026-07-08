import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const sourceRoots: ReadonlyArray<URL> = [
  new URL(".", import.meta.url),
  new URL("../../../../apps/marketing/src/", import.meta.url),
  new URL("../../../../packages/ui/src/", import.meta.url),
];

const sourceExtensions = new Set([".css", ".ts", ".tsx"]);
const productNamesForSelectorAttributes = [
  String.fromCharCode(108, 97, 114, 101, 115),
  ["nu", "dge"].join(""),
  String.fromCharCode(118, 101, 115, 116, 97),
];
const productSelectorAttributePattern = new RegExp(
  `\\bdata-(?:${productNamesForSelectorAttributes.join("|")})-[a-z0-9-]+`,
  "g",
);

describe("production UI selector contract", () => {
  test("keeps app names out of data attribute names", () => {
    const violations = productionSourceFiles().flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return Array.from(source.matchAll(productSelectorAttributePattern), (match) => {
        return `${relative(process.cwd(), file)} contains product-named selector attribute: ${match[0]}`;
      });
    });

    expect(violations).toEqual([]);
  });
});

function productionSourceFiles() {
  return sourceRoots.flatMap((root) => walkSource(root.pathname));
}

function walkSource(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return walkSource(file);
    if (!sourceExtensions.has(extname(entry.name))) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) return [];
    return [file];
  });
}
