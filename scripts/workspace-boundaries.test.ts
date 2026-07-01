import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const engineRuntimeImport = /@lares\/engine(?:["/])/;

function filesUnder(dir: string): ReadonlyArray<string> {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("workspace app boundaries", () => {
  test("web is an App Surface, not an Engine runtime consumer", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "apps/web/package.json"), "utf8")) as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };
    const dependencyNames = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    const sourceFiles = filesUnder(join(repoRoot, "apps/web/src")).filter((path) =>
      /\.(ts|tsx)$/.test(path),
    );

    expect(dependencyNames).not.toContain("@lares/engine");
    expect(
      sourceFiles.filter((path) => engineRuntimeImport.test(readFileSync(path, "utf8"))),
    ).toEqual([]);
  });
});
