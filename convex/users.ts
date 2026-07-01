import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { notAuthenticatedError } from "./authPolicy";
import { appUserProfileFromIdentity, type AppUserProfile } from "./usersPolicy";

type UserLookupCtx = QueryCtx | MutationCtx;

export const findUserByExternalId = async (ctx: UserLookupCtx, externalId: string) =>
  await ctx.db
    .query("users")
    .withIndex("by_external_id", (index) => index.eq("externalId", externalId))
    .first();

const userValuesFrom = (profile: AppUserProfile) => ({
  ...(profile.email ? { email: profile.email } : {}),
  ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
  ...(profile.name ? { name: profile.name } : {}),
});

export const currentAppUser = async (ctx: UserLookupCtx) => {
  const profile = appUserProfileFromIdentity(await ctx.auth.getUserIdentity());
  if (!profile) return null;

  return await findUserByExternalId(ctx, profile.externalId);
};

export const ensureCurrentAppUser = async (ctx: MutationCtx): Promise<Doc<"users"> | null> => {
  const profile = appUserProfileFromIdentity(await ctx.auth.getUserIdentity());
  if (!profile) return null;

  const now = new Date().toISOString();
  const existing = await findUserByExternalId(ctx, profile.externalId);
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...userValuesFrom(profile),
      updatedAt: now,
    });
    return await ctx.db.get(existing._id);
  }

  const userId = await ctx.db.insert("users", {
    ...userValuesFrom(profile),
    createdAt: now,
    externalId: profile.externalId,
    updatedAt: now,
  });

  return await ctx.db.get(userId);
};

export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentAppUser(ctx);
    return user ? { auth: "authenticated", user } : { auth: "unauthenticated", user: null };
  },
});

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ensureCurrentAppUser(ctx);
    if (!user) {
      return { error: notAuthenticatedError(), ok: false, user: null };
    }

    return { ok: true, user };
  },
});
