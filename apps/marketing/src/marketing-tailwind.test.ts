import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("marketing Tailwind setup", () => {
  test("uses the monorepo Tailwind pipeline", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

    const tailwindImportIndex = css.indexOf('@import "tailwindcss";');
    const sharedUiSourceIndex = css.indexOf('@source "../../../packages/ui/src";');

    expect(tailwindImportIndex).toBeGreaterThanOrEqual(0);
    expect(sharedUiSourceIndex).toBeGreaterThan(tailwindImportIndex);
    expect(css).toContain('@source "../../../packages/ui/src";');
    expect(viteConfig).toContain('import tailwindcss from "@tailwindcss/vite";');
    expect(viteConfig).toContain("tailwindcss()");
    expect(packageJson).toContain('"@tailwindcss/vite": "catalog:"');
    expect(packageJson).toContain('"tailwindcss": "catalog:"');
  });
});
