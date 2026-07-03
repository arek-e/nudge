import { LocalStorage, getPreferenceValues } from "@raycast/api";
import {
  createSurfaceEngineClient,
  generatedAnonymousUserId,
  surfaceAnonymousUserStorageKey,
} from "@nudge/surface";

export interface RaycastEnginePreferences {
  readonly bearerToken?: string;
  readonly engineUrl: string;
}

export async function raycastAnonymousUserId() {
  const existing = await LocalStorage.getItem<string>(surfaceAnonymousUserStorageKey);
  const normalized = existing?.trim().toLowerCase();
  if (normalized?.startsWith("anon_")) return normalized;

  const userId = generatedAnonymousUserId();
  await LocalStorage.setItem(surfaceAnonymousUserStorageKey, userId);
  return userId;
}

export async function raycastEngineClient<CommandPreferences extends RaycastEnginePreferences>() {
  const preferences = getPreferenceValues<CommandPreferences>();
  const bearerToken = preferences.bearerToken?.trim();
  return createSurfaceEngineClient({
    ...(bearerToken ? { bearerToken } : { anonymousUserId: await raycastAnonymousUserId() }),
    baseUrl: preferences.engineUrl,
    surface: "raycast",
  });
}
