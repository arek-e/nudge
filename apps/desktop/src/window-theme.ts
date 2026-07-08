type DesktopSurfaceToken = {
  readonly cssVariable: string;
  readonly value: `#${string}`;
};

export const desktopSurfaceTokens = {
  captureCanvas: {
    cssVariable: "--surface-capture-canvas",
    value: "#eef1f5",
  },
  warm: {
    cssVariable: "--surface-warm",
    value: "#fffaf6",
  },
} satisfies Record<string, DesktopSurfaceToken>;
