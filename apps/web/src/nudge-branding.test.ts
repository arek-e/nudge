import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const oldTitleName = String.fromCharCode(76, 97, 114, 101, 115);
const oldLowerName = oldTitleName.toLowerCase();
const binaryExtensions = new Set([
  ".gif",
  ".icns",
  ".ico",
  ".jpg",
  ".jpeg",
  ".lockb",
  ".mov",
  ".mp4",
  ".pdf",
  ".png",
  ".webp",
]);
const skippedDirectories = new Set([".git", ".wrangler", "dist", "node_modules", "tmp"]);
const skippedFiles = new Set(["bun.lock"]);

describe("Nudge branding", () => {
  test("repository source and provider config no longer use the old product name", async () => {
    const files = await sourceFiles(repoRoot);
    const scannedFiles = await Promise.all(
      files.map(async (file) => {
        const text = await readFile(file, "utf8");
        if (text.includes(oldTitleName) || text.includes(oldLowerName)) {
          return relative(repoRoot, file);
        }

        return undefined;
      }),
    );
    const matches = scannedFiles.filter((file) => file !== undefined);

    expect(matches).toEqual([]);
  });
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const fileGroups = await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith(".") && entry.name !== ".envrc" && entry.name !== ".oxfmtrc.json") {
        return [];
      }

      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) {
          return sourceFiles(path);
        }

        return [];
      }

      if (entry.isFile() && !skippedFiles.has(entry.name) && !isBinaryPath(entry.name)) {
        return [path];
      }

      return [];
    }),
  );

  return fileGroups.flat();
}

function isBinaryPath(path: string) {
  return binaryExtensions.has(path.slice(path.lastIndexOf(".")).toLowerCase());
}
