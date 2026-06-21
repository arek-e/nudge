import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
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
        passkey: schema.authPasskeys,
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
      emailOTP({
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendOtpEmail(env, { email, otp, type });
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(env, { email, url });
        },
      }),
      passkey({
        origin: env.BETTER_AUTH_URL,
        rpID: resolveRpId(env.BETTER_AUTH_URL),
        rpName: "Lares",
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

async function sendOtpEmail(
  env: Env,
  input: { readonly email: string; readonly otp: string; readonly type: string },
) {
  await sendAuthEmail(env, {
    email: input.email,
    html: `<p>Your Lares sign-in code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.16em">${escapeHtml(input.otp)}</p><p>This code expires soon.</p>`,
    logLabel: "Email OTP requested without SEND_EMAIL binding",
    subject: input.type === "sign-in" ? "Your Lares sign-in code" : "Your Lares verification code",
    text: `Your Lares code is: ${input.otp}`,
  });
}

async function sendMagicLinkEmail(
  env: Env,
  input: { readonly email: string; readonly url: string },
) {
  await sendAuthEmail(env, {
    email: input.email,
    html: `<p>Click this link to continue to Lares:</p><p><a href="${escapeHtml(input.url)}">Continue to Lares</a></p><p>This link expires soon.</p>`,
    logLabel: "Magic link requested without SEND_EMAIL binding",
    subject: "Continue to Lares",
    text: `Continue to Lares: ${input.url}`,
  });
}

async function sendAuthEmail(
  env: Env,
  input: {
    readonly email: string;
    readonly html: string;
    readonly logLabel: string;
    readonly subject: string;
    readonly text: string;
  },
) {
  if (!env.SEND_EMAIL) {
    if (env.ENVIRONMENT === "production") {
      throw new Error("SEND_EMAIL binding is required to send auth emails");
    }
    console.info(input.logLabel, {
      email: input.email,
    });
    return;
  }

  await env.SEND_EMAIL.send({
    from: "Lares <auth@teampitch.app>",
    html: input.html,
    subject: input.subject,
    text: input.text,
    to: input.email,
  });
}

function resolveRpId(baseUrl: string | undefined) {
  if (!baseUrl) return undefined;
  return new URL(baseUrl).hostname;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
