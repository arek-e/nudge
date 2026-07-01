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
  const plist = await readFile(plistPath, "utf8");

  return {
    CFBundleDisplayName: readPlistString(plist, "CFBundleDisplayName"),
    CFBundleSpokenName: readPlistString(plist, "CFBundleSpokenName"),
    INAlternativeAppNames: readPlistStringArray(plist, "INAlternativeAppNames"),
  };
}

function readAlternativeNames(info: Record<string, unknown>) {
  const value = Reflect.get(info, "INAlternativeAppNames");
  return Array.isArray(value) ? value : [];
}

function readPlistString(plist: string, key: string) {
  const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist);
  return match?.[1] ?? "";
}

function readPlistStringArray(plist: string, key: string) {
  const match = new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`).exec(plist);
  const body = match?.[1] ?? "";
  return Array.from(body.matchAll(/<string>([^<]*)<\/string>/g), (item) => item[1] ?? "");
}
