import type { AuthConfig } from "convex/server";

declare const process: {
  readonly env: {
    readonly CLERK_JWT_ISSUER_DOMAIN?: string;
  };
};

const clerkIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

export default {
  providers: clerkIssuerDomain
    ? [
        {
          applicationID: "convex",
          domain: clerkIssuerDomain,
        },
      ]
    : [],
} satisfies AuthConfig;
