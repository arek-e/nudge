import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { createD1DrizzleDatabase, schema } from "@lares/db";
import type { Env } from "./env";

export type AuthSessionUser = {
  readonly id: string;
  readonly name?: string | null;
  readonly email?: string | null;
};

export type AuthSession = {
  readonly user: AuthSessionUser;
};

export type AuthSessionResolver = (input: {
  readonly env: Env;
  readonly headers: Headers;
}) => Promise<AuthSession | null>;

export function createBetterAuth(
  env: Env,
  options: { readonly allowSignUpForSeed?: boolean } = {},
) {
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required to enable Better Auth");
  }

  const db = createD1DrizzleDatabase(env.DB);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema,
        account: schema.authAccounts,
        session: schema.authSessions,
        user: schema.authUsers,
        verification: schema.authVerifications,
      },
    }),
    emailAndPassword: {
      disableSignUp: !options.allowSignUpForSeed && env.BETTER_AUTH_ALLOW_SIGN_UP !== "true",
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
  });
}

export const isBetterAuthConfigured = (env: Env) => Boolean(env.BETTER_AUTH_SECRET);

export const resolveBetterAuthSession: AuthSessionResolver = async ({ env, headers }) => {
  if (!isBetterAuthConfigured(env)) return null;

  const auth = createBetterAuth(env);
  return auth.api.getSession({ headers });
};
