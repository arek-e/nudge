import type { User } from "@clerk/backend";
import { createClerkClient } from "@clerk/backend";
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
  readonly request: Request;
}) => Promise<AuthSession | null>;

export type DesktopSignInToken = {
  readonly expiresInSeconds: number;
  readonly ticket: string;
};

export type DesktopSignInTokenFactory = (input: {
  readonly env: Env;
  readonly userId: string;
}) => Promise<DesktopSignInToken>;

export const desktopSignInTokenExpiresInSeconds = 120;

export const isClerkConfigured = (env: Env) => Boolean(env.CLERK_SECRET_KEY);

export const resolveClerkSession: AuthSessionResolver = async ({ env, request }) => {
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey) {
    if (env.ENVIRONMENT === "production") {
      throw new Error("CLERK_SECRET_KEY is required to authenticate production requests");
    }
    return null;
  }

  const clerk = createClerkClient({
    ...(env.CLERK_PUBLISHABLE_KEY ? { publishableKey: env.CLERK_PUBLISHABLE_KEY } : {}),
    secretKey,
  });
  const authorizedParties = clerkAuthorizedParties(env);
  const requestState = await clerk.authenticateRequest(request, {
    acceptsToken: "session_token",
    ...(authorizedParties ? { authorizedParties } : {}),
  });
  if (!requestState.isAuthenticated) return null;

  const auth = requestState.toAuth();
  if (!auth.isAuthenticated || !auth.userId) return null;

  const user = await clerk.users.getUser(auth.userId);
  return {
    user: {
      email: user.primaryEmailAddress?.emailAddress ?? null,
      id: auth.userId,
      name: clerkDisplayName(user),
    },
  };
};

export const createClerkDesktopSignInToken: DesktopSignInTokenFactory = async ({ env, userId }) => {
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is required to create desktop sign-in tokens");

  const clerk = createClerkClient({
    ...(env.CLERK_PUBLISHABLE_KEY ? { publishableKey: env.CLERK_PUBLISHABLE_KEY } : {}),
    secretKey,
  });
  const signInToken = await clerk.signInTokens.createSignInToken({
    expiresInSeconds: desktopSignInTokenExpiresInSeconds,
    userId,
  });
  return {
    expiresInSeconds: desktopSignInTokenExpiresInSeconds,
    ticket: signInToken.token,
  };
};

function clerkDisplayName(user: User) {
  return user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? user.id;
}

function clerkAuthorizedParties(env: Env) {
  const rawParties = env.CLERK_AUTHORIZED_PARTIES;
  if (!rawParties) return undefined;

  const parties = rawParties
    .split(",")
    .map((party) => party.trim())
    .filter((party) => party.length > 0);
  return parties.length > 0 ? parties : undefined;
}
