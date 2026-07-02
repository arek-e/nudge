import { Layer } from "effect";
import { Db } from "@nudge/db";
import { convexDbLayer, makeConvexRuntimeLayer } from "@nudge/db-convex";
import type { Env } from "./env";
import { api } from "../../../convex/_generated/api";

export type NudgeDbLayer = Layer.Layer<Db>;

const convexLayers = new WeakMap<Env, NudgeDbLayer>();

export function resolveDbLayerForEnv(env: Env, override?: NudgeDbLayer) {
  if (override) return override;
  if (!env.CONVEX_URL || !env.CONVEX_RUNTIME_SECRET) {
    throw new Error(
      "Convex runtime store is not configured. Set CONVEX_URL and CONVEX_RUNTIME_SECRET.",
    );
  }

  const existing = convexLayers.get(env);
  if (existing) return existing;
  const convexRuntimeLayer = makeConvexRuntimeLayer({
    runtimeSecret: env.CONVEX_RUNTIME_SECRET,
    store: api.store,
    url: env.CONVEX_URL,
  });
  const layer = convexDbLayer.pipe(Layer.provide(convexRuntimeLayer));
  convexLayers.set(env, layer);
  return layer;
}
