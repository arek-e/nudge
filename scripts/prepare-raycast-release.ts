import { copyFile, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(currentFile));
const raycastDirectory = join(repoRoot, "apps/raycast");
const distDirectory = join(raycastDirectory, "dist");

await copyFile(join(raycastDirectory, "INSTALL.md"), join(distDirectory, "README.md"));

const files = await listFiles(distDirectory);

for (const file of files) {
  if (file.endsWith(".js.map")) {
    await rm(file);
  }
}

for (const file of files) {
  if (extname(file) !== ".js") continue;
  const source = await readFile(file, "utf8");
  const cleaned = source.replace(/\n\/\/# sourceMappingURL=.*?\.map\s*$/u, "\n");
  if (cleaned !== source) await writeFile(file, cleaned);
}

const remainingFiles = await listFiles(distDirectory);
const forbiddenFiles = remainingFiles.filter(
  (file) => file.endsWith(".map") || file.endsWith(".ts") || file.endsWith(".tsx"),
);

if (forbiddenFiles.length > 0) {
  console.error("Raycast release package must not include TypeScript source or source maps.");
  for (const file of forbiddenFiles) console.error(file);
  process.exit(1);
}

console.log(`Prepared Raycast release package at ${distDirectory}`);

async function listFiles(directory: string): Promise<ReadonlyArray<string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: Array<string> = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }
    if (entry.isFile()) files.push(entryPath);
  }

  return files;
}
