import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
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
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(env, { email, url });
        },
      }),
    ],
    secret: env.BETTER_AUTH_SECRET,
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,
  });
}

export const isBetterAuthConfigured = (env: Env) => Boolean(env.BETTER_AUTH_SECRET);

export const resolveBetterAuthSession: AuthSessionResolver = async ({ env, headers }) => {
  if (!isBetterAuthConfigured(env)) return null;

  const auth = createBetterAuth(env);
  return auth.api.getSession({ headers });
};

async function sendMagicLinkEmail(
  env: Env,
  input: { readonly email: string; readonly url: string },
) {
  if (!env.SEND_EMAIL) {
    if (env.ENVIRONMENT === "production") {
      throw new Error("SEND_EMAIL binding is required to send magic links");
    }
    console.info("Magic link requested without SEND_EMAIL binding", {
      email: input.email,
      url: input.url,
    });
    return;
  }

  await env.SEND_EMAIL.send({
    from: "Lares <auth@teampitch.app>",
    html: `<p>Click this link to continue to Lares:</p><p><a href="${escapeHtml(input.url)}">Continue to Lares</a></p><p>This link expires soon.</p>`,
    subject: "Continue to Lares",
    text: `Continue to Lares: ${input.url}`,
    to: input.email,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
