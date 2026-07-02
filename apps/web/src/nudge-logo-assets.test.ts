import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";

const indexUrl = new URL("../index.html", import.meta.url);
const publicUrl = new URL("../public/", import.meta.url);
const iconsUrl = new URL("../public/icons/", import.meta.url);
const readmeUrl = new URL("../../../README.md", import.meta.url);

const pngSignature = "89504e470d0a1a0a";

describe("Nudge logo assets", () => {
  test("favicon and PWA icon set are generated from Nudge assets", async () => {
    await expectSvg("favicon.svg");
    await expectSvg("icons/icon.svg");
    await expectSvg("icons/nudge-app-icon.svg");
    await expectSvg("icons/nudge-app-icon-transparent.svg");
    await expectSvg("icons/nudge-logo-lockup-blobby-n.svg");
    await expectSvg("icons/nudge-logo-lockup-blobby-n-transparent.svg");
    await expectPng("icons/icon-16.png", 16, 16);
    await expectPng("icons/icon-32.png", 32, 32);
    await expectPng("icons/icon-48.png", 48, 48);
    await expectPng("icons/apple-touch-icon.png", 180, 180);
    await expectPng("icons/icon-192.png", 192, 192);
    await expectPng("icons/icon-512.png", 512, 512);
    await expectPng("icons/nudge-app-icon.png", 512, 512);
    await expectPng("icons/nudge-app-icon-transparent-512.png", 512, 512);
    await expectPng("icons/nudge-logo-lockup-blobby-n.png", 1287, 438);
    await expectPng("icons/nudge-logo-lockup-blobby-n-transparent.png", 1287, 438);

    const favicon = await readFile(new URL("favicon.ico", publicUrl));
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    expect(favicon.readUInt16LE(4)).toBe(6);

    const manifest = await readFile(new URL("manifest.webmanifest", publicUrl), "utf8");
    expect(manifest).toContain('"name": "Nudge"');
    expect(manifest).toContain("/icons/icon-192.png");
    expect(manifest).toContain("/icons/icon-512.png");
    expect(manifest).toContain("/icons/icon.svg");
  });

  test("old Vesta logo assets and generated exploration sheets are pruned", async () => {
    const files = await readdir(iconsUrl);
    const staleAssets = files.filter((file) => {
      return (
        file.startsWith("vesta-") ||
        file.includes("concept") ||
        file.includes("spritesheet") ||
        file.includes("cutout-mark")
      );
    });

    expect(staleAssets).toEqual([]);
  });

  test("HTML entry points expose the Nudge favicon set", async () => {
    await expectIconLinks(indexUrl);
    await expectIconLinks(new URL("offline.html", publicUrl));
  });

  test("GitHub README exposes the Nudge brand assets", async () => {
    const readme = await readFile(readmeUrl, "utf8");

    expect(readme).toContain("apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.svg");
    expect(readme).toContain("apps/web/public/icons/nudge-app-icon.svg");
    expect(readme).not.toContain("vesta-logo");
    expect(readme).not.toContain("vesta-app-icon");
  });
});

async function expectSvg(path: string) {
  const svg = await readFile(new URL(path, publicUrl), "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("Nudge");
  expect(svg).not.toContain("Vesta");
}

async function expectPng(path: string, width: number, height: number) {
  const png = await readFile(new URL(path, publicUrl));
  expect(png.subarray(0, 8).toString("hex")).toBe(pngSignature);
  expect(png.readUInt32BE(16)).toBe(width);
  expect(png.readUInt32BE(20)).toBe(height);
}

async function expectIconLinks(url: URL) {
  const html = await readFile(url, "utf8");
  expect(html).toContain('href="/manifest.webmanifest"');
  expect(html).toContain('href="/favicon.ico"');
  expect(html).toContain('href="/favicon.svg"');
  expect(html).toContain('href="/icons/apple-touch-icon.png"');
  expect(html).toContain("Nudge");
  expect(html).not.toContain("Vesta");
}
