const reactScanRootId = "react-scan-root";
const reactScanToolbarSelector = "#react-scan-toolbar";
const reactScanToolbarPatchAttribute = "data-react-scan-toolbar-hit-targets";
const defaultReactScanToolbarPatchTimeoutMs = 5_000;

type ReactScanToolbarHitTargetOptions = {
  readonly documentRef?: Document;
  readonly timeoutMs?: number;
  readonly windowRef?: Pick<Window, "clearTimeout" | "setTimeout">;
};

export function restoreReactScanToolbarHitTargets(options: ReactScanToolbarHitTargetOptions = {}) {
  const documentRef =
    options.documentRef ?? (typeof document === "undefined" ? undefined : document);
  const windowRef = options.windowRef ?? (typeof window === "undefined" ? undefined : window);

  if (!documentRef || !windowRef || typeof MutationObserver === "undefined") {
    return () => undefined;
  }

  const activeDocument = documentRef;
  const activeWindow = windowRef;
  let timeoutId: number | undefined;
  const observer = new MutationObserver(() => {
    if (installReactScanToolbarPatch(activeDocument)) stop();
  });

  function stop() {
    observer.disconnect();
    if (timeoutId !== undefined) activeWindow.clearTimeout(timeoutId);
  }

  if (installReactScanToolbarPatch(activeDocument)) return stop;

  observer.observe(activeDocument.documentElement, {
    childList: true,
    subtree: true,
  });
  timeoutId = activeWindow.setTimeout(
    stop,
    options.timeoutMs ?? defaultReactScanToolbarPatchTimeoutMs,
  );

  return stop;
}

function installReactScanToolbarPatch(documentRef: Document) {
  const reactScanRoot = documentRef.getElementById(reactScanRootId);
  const reactScanShadowRoot = reactScanRoot?.shadowRoot;
  if (!reactScanShadowRoot) return false;
  if (reactScanShadowRoot.querySelector(`style[${reactScanToolbarPatchAttribute}]`)) return true;

  const style = documentRef.createElement("style");
  style.setAttribute(reactScanToolbarPatchAttribute, "true");
  style.textContent = `
${reactScanToolbarSelector} {
  pointer-events: auto !important;
}

${reactScanToolbarSelector} :is(
  button,
  input,
  select,
  textarea,
  [role="button"],
  .react-scan-header
) {
  pointer-events: auto !important;
}
`;
  reactScanShadowRoot.append(style);

  return true;
}
