import type { AuthConfig } from "convex/server";

declare const process: {
  readonly env: {
    readonly CLERK_FRONTEND_API_URL?: string;
    readonly CLERK_JWT_ISSUER_DOMAIN?: string;
  };
};

const clerkIssuerDomain = process.env.CLERK_FRONTEND_API_URL ?? process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!clerkIssuerDomain) {
  throw new Error("CLERK_FRONTEND_API_URL is required for Convex Clerk auth");
}

export default {
  providers: [
    {
      applicationID: "convex",
      domain: clerkIssuerDomain,
    },
  ],
} satisfies AuthConfig;
