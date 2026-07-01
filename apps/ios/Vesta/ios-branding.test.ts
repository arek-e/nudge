import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const iosRoot = new URL(".", import.meta.url);
const oldProductName = String.fromCharCode(76, 97, 114, 101, 115);
const oldSpokenFallback = String.fromCharCode(76, 97, 121, 101, 114, 115);
const oldPronunciationHint = "lair";

describe("Vesta iOS branding", () => {
  test("bundle and Siri metadata expose Vesta without old spoken-name fallbacks", async () => {
    const info = await readInfoPlist();
    const alternativeNames = readAlternativeNames(info);

    expect(info.CFBundleDisplayName).toBe("Vesta");
    expect(info.CFBundleSpokenName).toBe("Vesta");
    expect(JSON.stringify(alternativeNames)).not.toContain(oldProductName);
    expect(JSON.stringify(alternativeNames)).not.toContain(oldSpokenFallback);
    expect(JSON.stringify(alternativeNames).toLowerCase()).not.toContain(oldPronunciationHint);
  });

  test("Siri documentation teaches Vesta phrases only", async () => {
    const readme = await readFile(new URL("README.md", iosRoot), "utf8");

    expect(readme).toContain("Tell Vesta");
    expect(readme).toContain("Log this in Vesta");
    expect(readme).not.toContain(oldProductName);
    expect(readme).not.toContain(oldSpokenFallback);
  });
});

async function readInfoPlist() {
  const plistPath = new URL("Vesta/Info.plist", iosRoot).pathname;
  const result = Bun.spawnSync(["plutil", "-convert", "json", "-o", "-", plistPath], {
    stderr: "pipe",
    stdout: "pipe",
  });

  if (!result.success) {
    throw new Error(result.stderr.toString());
  }

  return JSON.parse(result.stdout.toString()) as Record<string, unknown>;
}

function readAlternativeNames(info: Record<string, unknown>) {
  const value = Reflect.get(info, "INAlternativeAppNames");
  return Array.isArray(value) ? value : [];
}
