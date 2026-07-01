import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const animatedLogoUrl = new URL("../public/icons/vesta-logo-animated.svg", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const publicUrl = new URL("../public/", import.meta.url);
const readmeUrl = new URL("../../../README.md", import.meta.url);

const pngSignature = "89504e470d0a1a0a";

describe("Vesta logo assets", () => {
  test("animated logo is accessible, vector-only, and motion-safe", async () => {
    const animatedLogo = await readFile(animatedLogoUrl, "utf8");

    expect(animatedLogo).toContain("<title");
    expect(animatedLogo).toContain("Animated Vesta logo");
    expect(animatedLogo).toContain('id="vesta-mouth"');
    expect(animatedLogo).toContain('id="vesta-mouth-line"');
    expect(animatedLogo).toContain("stroke-dasharray");
    expect(animatedLogo).toContain("stroke-dashoffset");
    expect(animatedLogo).toContain(
      "animation: vesta-mouth-grow 860ms 220ms cubic-bezier(0.77, 0, 0.175, 1) forwards",
    );
    expect(animatedLogo).toContain("vesta-mouth-grow");
    expect(animatedLogo).toContain("vesta-mouth-settle");
    expect(animatedLogo).toContain("scaleX(1.028) translateY(0.4px)");
    expect(animatedLogo).toContain("vesta-spark-activate");
    expect(animatedLogo).toContain(
      "animation: vesta-spark-activate 360ms 1260ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
    );
    expect(animatedLogo).toContain("rotate(2.5deg) scale(1.04)");
    expect(animatedLogo).toContain("prefers-reduced-motion");
    expect(animatedLogo).not.toContain("<image");
    expect(animatedLogo).not.toContain('attributeName="d"');
    expect(animatedLogo).not.toContain("base64");
    expect(animatedLogo).not.toContain("infinite");
    expect(animatedLogo).not.toContain("opacity:");
  });

  test("favicon and PWA icon set are generated from Vesta assets", async () => {
    await expectSvg("favicon.svg");
    await expectSvg("icons/icon.svg");
    await expectSvg("icons/vesta-logo-light.svg");
    await expectSvg("icons/vesta-logo-dark.svg");
    await expectSvg("icons/vesta-logo-long-light.svg");
    await expectSvg("icons/vesta-logo-long-dark.svg");
    await expectSvg("icons/vesta-app-icon-light.svg");
    await expectPng("icons/icon-16.png", 16, 16);
    await expectPng("icons/icon-32.png", 32, 32);
    await expectPng("icons/icon-48.png", 48, 48);
    await expectPng("icons/apple-touch-icon.png", 180, 180);
    await expectPng("icons/icon-192.png", 192, 192);
    await expectPng("icons/icon-512.png", 512, 512);
    await expectPng("icons/vesta-app-icon.png", 512, 512);
    await expectPng("icons/vesta-logo.png", 512, 512);
    await expectPng("icons/vesta-logo-animated.png", 512, 512);
    await expectPng("icons/vesta-logo-long.png", 1024, 441);

    const favicon = await readFile(new URL("favicon.ico", publicUrl));
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    expect(favicon.readUInt16LE(4)).toBe(3);

    const manifest = await readFile(new URL("manifest.webmanifest", publicUrl), "utf8");
    expect(manifest).toContain("/icons/icon-192.png");
    expect(manifest).toContain("/icons/icon-512.png");
    expect(manifest).toContain("/icons/icon.svg");
  });

  test("light and dark SVG logo variants keep the Vesta palette", async () => {
    await expectPalette("icons/vesta-logo-light.svg", {
      background: false,
      ink: "#1a2735",
    });
    await expectPalette("icons/vesta-logo-long-light.svg", {
      background: false,
      ink: "#1a2735",
    });
    await expectPalette("icons/vesta-app-icon-light.svg", {
      background: true,
      ink: "#1a2735",
    });
    await expectPalette("icons/vesta-logo-dark.svg", {
      background: false,
      ink: "#f7f3ec",
    });
    await expectPalette("icons/vesta-logo-long-dark.svg", {
      background: false,
      ink: "#f7f3ec",
    });
  });

  test("HTML entry points expose the complete Vesta favicon set", async () => {
    await expectIconLinks(indexUrl);
    await expectIconLinks(new URL("offline.html", publicUrl));
  });

  test("GitHub README exposes the light and dark Vesta brand assets", async () => {
    const readme = await readFile(readmeUrl, "utf8");

    expect(readme).toContain("apps/web/public/icons/vesta-logo-long-light.svg");
    expect(readme).toContain("apps/web/public/icons/vesta-logo-long-dark.svg");
    expect(readme).toContain("apps/web/public/icons/vesta-logo-light.svg");
    expect(readme).toContain("apps/web/public/icons/vesta-logo-dark.svg");
    expect(readme).toContain("apps/web/public/icons/vesta-app-icon-light.svg");
    expect(readme).toContain("apps/web/public/icons/vesta-logo-animated.svg");
  });
});

async function expectSvg(path: string) {
  const svg = await readFile(new URL(path, publicUrl), "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("Vesta");
}

async function expectPalette(
  path: string,
  expected: { readonly background: boolean; readonly ink: string },
) {
  const svg = await readFile(new URL(path, publicUrl), "utf8");
  expect(svg).toContain("#ec5c29");
  expect(svg).toContain(expected.ink);
  if (expected.background) {
    expect(svg).toContain("#f7f3ec");
    expect(svg).toContain("<rect");
    return;
  }

  expect(svg).not.toContain("<rect");
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
}
