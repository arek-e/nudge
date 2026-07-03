/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as authPolicy from "../authPolicy.js";
import type * as documents from "../documents.js";
import type * as spikePolicy from "../spikePolicy.js";
import type * as stickyNotePolicy from "../stickyNotePolicy.js";
import type * as stickyNotes from "../stickyNotes.js";
import type * as store from "../store.js";
import type * as storePolicy from "../storePolicy.js";
import type * as users from "../users.js";
import type * as usersPolicy from "../usersPolicy.js";

declare const fullApi: ApiFromModules<{
  authPolicy: typeof authPolicy;
  documents: typeof documents;
  spikePolicy: typeof spikePolicy;
  stickyNotePolicy: typeof stickyNotePolicy;
  stickyNotes: typeof stickyNotes;
  store: typeof store;
  storePolicy: typeof storePolicy;
  users: typeof users;
  usersPolicy: typeof usersPolicy;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {};
