interface RaycastEnginePreferences {
  readonly bearerToken?: string;
  readonly engineUrl: string;
}

declare namespace Preferences {
  interface Capture extends RaycastEnginePreferences {}

  interface CurrentContext extends RaycastEnginePreferences {}

  interface Ask extends RaycastEnginePreferences {}
}
