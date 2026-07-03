import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";

const iosRoot = new URL(".", import.meta.url);
const repoRoot = new URL("../../..", import.meta.url);
const oldProductName = String.fromCharCode(76, 97, 114, 101, 115);
const oldSpokenFallback = String.fromCharCode(76, 97, 121, 101, 114, 115);
const previousProductName = String.fromCharCode(86, 101, 115, 116, 97);
const oldPronunciationHint = "lair";
const pngSignature = "89504e470d0a1a0a";

describe("Nudge iOS branding", () => {
  test("bundle and Siri metadata expose Nudge without old spoken-name fallbacks", async () => {
    const info = await readInfoPlist();
    const project = await readFile(new URL("Nudge.xcodeproj/project.pbxproj", iosRoot), "utf8");
    const schemes = await readSchemeNames();
    const alternativeNames = readAlternativeNames(info);

    expect(info.CFBundleDisplayName).toBe("$(NUDGE_DISPLAY_NAME)");
    expect(schemes).toEqual([
      "Nudge Local.xcscheme",
      "Nudge Production.xcscheme",
      "Nudge Staging.xcscheme",
    ]);
    expect(project).toContain("path = Nudge.app;");
    expect(project).toContain("productName = Nudge;");
    expect(project).toContain("PRODUCT_NAME = Nudge;");
    expect(buildSettingsForBundle(project, "app.nudge.ios.local")).toContain(
      "NUDGE_DISPLAY_NAME = Nudge;",
    );
    expect(buildSettingsForBundle(project, "app.nudge.ios.staging")).toContain(
      "NUDGE_DISPLAY_NAME = Nudge;",
    );
    expect(buildSettingsForBundle(project, "app.nudge.ios")).toContain(
      "NUDGE_DISPLAY_NAME = Nudge;",
    );
    expect(info.CFBundleSpokenName).toBe("Nudge");
    expect(JSON.stringify(alternativeNames)).not.toContain(oldProductName);
    expect(JSON.stringify(alternativeNames)).not.toContain(oldSpokenFallback);
    expect(JSON.stringify(alternativeNames).toLowerCase()).not.toContain(oldPronunciationHint);
  });

  test("Siri documentation teaches Nudge phrases only", async () => {
    const readme = await readFile(new URL("README.md", iosRoot), "utf8");

    expect(readme).toContain("Tell Nudge");
    expect(readme).toContain("Log this in Nudge");
    expect(readme).not.toContain(oldProductName);
    expect(readme).not.toContain(oldSpokenFallback);
  });

  test("repository README presents the iOS app and release status honestly", async () => {
    const readme = await readFile(new URL("README.md", repoRoot), "utf8");

    expect(readme).toContain("Native iOS app");
    expect(readme).toContain("Siri capture");
    expect(readme).toContain("TestFlight/App Store deployment is not wired yet");
    expect(readme).toContain("GitHub Actions deploys the Cloudflare Worker");
  });

  test("iOS build variants declare local, staging, and production environments", async () => {
    const info = await readInfoPlist();
    const project = await readFile(new URL("Nudge.xcodeproj/project.pbxproj", iosRoot), "utf8");

    expect(info.CFBundleDisplayName).toBe("$(NUDGE_DISPLAY_NAME)");
    expect(info.NudgeEnvironmentName).toBe("$(NUDGE_ENVIRONMENT_NAME)");
    expect(info.NudgeEngineURL).toBe("$(NUDGE_ENGINE_URL)");
    expect(info.NudgeConvexDeploymentURL).toBe("$(NUDGE_CONVEX_DEPLOYMENT_URL)");

    expect(project).toContain("name = Staging;");
    expect(project).toContain("NUDGE_ENVIRONMENT_NAME = local;");
    expect(project).toContain("NUDGE_ENVIRONMENT_NAME = staging;");
    expect(project).toContain("NUDGE_ENVIRONMENT_NAME = production;");
    expect(project).toContain("PRODUCT_BUNDLE_IDENTIFIER = app.nudge.ios.local;");
    expect(project).toContain("PRODUCT_BUNDLE_IDENTIFIER = app.nudge.ios.staging;");
    expect(project).toContain("PRODUCT_BUNDLE_IDENTIFIER = app.nudge.ios;");
    expect(project).toContain('NUDGE_ENGINE_URL = "http://localhost:8787";');
    expect(project).toContain(
      'NUDGE_ENGINE_URL = "https://nudge-web-staging.teampitch.workers.dev";',
    );
    expect(project).toContain('NUDGE_ENGINE_URL = "https://nudge-web.teampitch.workers.dev";');
    expect(buildSettingsForBundle(project, "app.nudge.ios.local")).toContain(
      'NUDGE_CONVEX_DEPLOYMENT_URL = "https://grandiose-hamster-855.eu-west-1.convex.cloud";',
    );
    expect(buildSettingsForBundle(project, "app.nudge.ios.staging")).toContain(
      'NUDGE_CONVEX_DEPLOYMENT_URL = "https://abundant-retriever-130.eu-west-1.convex.cloud";',
    );
    expect(buildSettingsForBundle(project, "app.nudge.ios")).toContain(
      'NUDGE_CONVEX_DEPLOYMENT_URL = "https://friendly-lion-904.eu-west-1.convex.cloud";',
    );
    expect(project).toContain(
      'CLERK_PUBLISHABLE_KEY = "pk_test_cmVuZXdlZC1zZWFzbmFpbC0zOC5jbGVyay5hY2NvdW50cy5kZXYk";',
    );
  });

  test("iOS project folders and schemes use Nudge paths", async () => {
    const project = await readFile(new URL("Nudge.xcodeproj/project.pbxproj", iosRoot), "utf8");
    const stagingScheme = await readFile(
      new URL("Nudge.xcodeproj/xcshareddata/xcschemes/Nudge Staging.xcscheme", iosRoot),
      "utf8",
    );

    expect(project).toContain("path = Nudge;");
    expect(project).toContain("name = Nudge;");
    expect(project).toContain("INFOPLIST_FILE = Nudge/Info.plist;");
    expect(project).toContain('Build configuration list for PBXNativeTarget "Nudge"');
    expect(project).not.toContain(`path = ${previousProductName};`);
    expect(project).not.toContain(`INFOPLIST_FILE = ${previousProductName}/Info.plist;`);
    expect(stagingScheme).toContain('BlueprintName = "Nudge"');
    expect(stagingScheme).toContain('ReferencedContainer = "container:Nudge.xcodeproj"');
    expect(stagingScheme).not.toContain(`BlueprintName = "${previousProductName}"`);
    expect(stagingScheme).not.toContain(`container:${previousProductName}.xcodeproj`);
  });

  test("staging build installs with the Nudge app icon", async () => {
    const project = await readFile(new URL("Nudge.xcodeproj/project.pbxproj", iosRoot), "utf8");
    const sourceIcon = await readFile(new URL("NudgeAppIcon.svg", iosRoot), "utf8");
    const normalAppIcon = await readAppIconSet("AppIcon");
    const stagingAppIcon = await readAppIconSet("AppIconStaging");

    expect(sourceIcon).toContain("Nudge iOS app icon");
    expect(sourceIcon).toContain('transform="translate(-9.55 4.25)"');
    expect(project).toContain("Assets.xcassets in Resources");
    expect(buildSettingsForBundle(project, "app.nudge.ios.local")).toContain(
      "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;",
    );
    expect(buildSettingsForBundle(project, "app.nudge.ios.staging")).toContain(
      "ASSETCATALOG_COMPILER_APPICON_NAME = AppIconStaging;",
    );
    expect(buildSettingsForBundle(project, "app.nudge.ios")).toContain(
      "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;",
    );
    expect(appIconFilenames(normalAppIcon)).toContain("Icon-1024.png");
    expect(appIconFilenames(stagingAppIcon)).toContain("Icon-1024.png");

    const normalPng = await expectPng(
      "Nudge/Assets.xcassets/AppIcon.appiconset/Icon-1024.png",
      1024,
      1024,
    );
    const stagingPng = await expectPng(
      "Nudge/Assets.xcassets/AppIconStaging.appiconset/Icon-1024.png",
      1024,
      1024,
    );
    expect(stagingPng.equals(normalPng)).toBe(true);
  });
});

async function readInfoPlist() {
  const plistPath = new URL("Nudge/Info.plist", iosRoot).pathname;
  const plist = await readFile(plistPath, "utf8");

  return {
    CFBundleDisplayName: readPlistString(plist, "CFBundleDisplayName"),
    CFBundleSpokenName: readPlistString(plist, "CFBundleSpokenName"),
    INAlternativeAppNames: readPlistStringArray(plist, "INAlternativeAppNames"),
    NudgeConvexDeploymentURL: readPlistString(plist, "NudgeConvexDeploymentURL"),
    NudgeEngineURL: readPlistString(plist, "NudgeEngineURL"),
    NudgeEnvironmentName: readPlistString(plist, "NudgeEnvironmentName"),
  };
}

async function readSchemeNames() {
  const entries = await readdir(new URL("Nudge.xcodeproj/xcshareddata/xcschemes", iosRoot));
  return entries.filter((entry) => entry.endsWith(".xcscheme")).sort();
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

async function readAppIconSet(name: string) {
  const contents = await readFile(
    new URL(`Nudge/Assets.xcassets/${name}.appiconset/Contents.json`, iosRoot),
    "utf8",
  );
  return JSON.parse(contents);
}

function appIconFilenames(contents: unknown) {
  const images = Reflect.get(Object(contents), "images");
  if (!Array.isArray(images)) return [];
  return images
    .map((image) => Reflect.get(Object(image), "filename"))
    .filter((filename) => typeof filename === "string");
}

async function expectPng(path: string, width: number, height: number) {
  const png = await readFile(new URL(path, iosRoot));
  expect(png.subarray(0, 8).toString("hex")).toBe(pngSignature);
  expect(png.readUInt32BE(16)).toBe(width);
  expect(png.readUInt32BE(20)).toBe(height);
  return png;
}

function buildSettingsForBundle(project: string, bundleIdentifier: string) {
  const bundleLine = `PRODUCT_BUNDLE_IDENTIFIER = ${bundleIdentifier};`;
  const bundleIndex = project.indexOf(bundleLine);
  expect(bundleIndex).toBeGreaterThanOrEqual(0);
  const blockStart = project.lastIndexOf("buildSettings = {", bundleIndex);
  const blockEnd = project.indexOf("};", bundleIndex);
  expect(blockStart).toBeGreaterThanOrEqual(0);
  expect(blockEnd).toBeGreaterThan(bundleIndex);
  return project.slice(blockStart, blockEnd);
}
