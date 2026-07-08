import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const colorVariables: ReadonlyArray<string> = [
  "--accent-primary",
  "--content-card",
  "--content-strong",
  "--content-subtle",
  "--content-workbench-body",
  "--interaction-hover",
  "--line-divider",
  "--line-soft",
  "--surface-base",
  "--surface-page",
  "--surface-page-muted",
  "--surface-sidebar",
];

const measurementVariables: ReadonlyArray<string> = ["--border-width-workbench"];

const sourceRoots: ReadonlyArray<URL> = [
  new URL(".", import.meta.url),
  new URL("../../../../packages/ui/src/", import.meta.url),
];

const sourceExtensions = new Set([".css", ".ts", ".tsx"]);

describe("design system color tokens", () => {
  test("defines purpose-based workspace colors as CSS variables and Tailwind theme colors", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

    for (const variable of colorVariables) {
      expect(css).toContain(`${variable}:`);
      expect(css).toContain(`--color-${variable.slice(2)}: var(${variable})`);
    }

    for (const variable of measurementVariables) {
      expect(css).toContain(`${variable}:`);
    }
    expect(css).toContain("--border-width-workbench: 1.5px;");
    expect(css).not.toContain("--nudge-workbench");
  });

  test("keeps production UI colors routed through design tokens", () => {
    const violations = productionSourceFiles().flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const matches: string[] = [];
      collectMatches(source, /#[0-9a-fA-F]{3,8}\b|rgba?\(/g, matches, file, "raw color");
      collectMatches(
        source,
        /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:\/|-|\b)/g,
        matches,
        file,
        "named utility color",
      );
      collectMatches(
        source,
        /--nudge|(?:bg|text|border|color)-nudge/g,
        matches,
        file,
        "product-named design token",
      );
      return matches;
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
    if (file.endsWith("/styles.css")) return [];
    if (file.endsWith("/packages/ui/src/marketing.tsx")) return [];
    return [file];
  });
}

function collectMatches(
  source: string,
  pattern: RegExp,
  matches: string[],
  file: string,
  label: string,
) {
  for (const match of source.matchAll(pattern)) {
    matches.push(`${relative(process.cwd(), file)} contains ${label}: ${match[0]}`);
  }
}
