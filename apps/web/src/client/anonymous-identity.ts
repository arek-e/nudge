import {
  anonymousUserIdFromStorage,
  buildSurfaceIdentityHeaders,
  generatedAnonymousUserId,
} from "@nudge/surface";
import { currentAppSurface } from "./surface-runtime";

export { generatedAnonymousUserId };

export function anonymousUserId() {
  return anonymousUserIdFromStorage({ storage: globalThis.localStorage });
}

export function anonymousIdentityHeaders() {
  return buildSurfaceIdentityHeaders({
    anonymousUserId: anonymousUserId(),
    surface: currentAppSurface(),
  });
}
