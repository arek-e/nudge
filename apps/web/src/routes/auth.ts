import type { Hono } from "hono";
import type { HonoHandlerContext, ResolveRequestApp } from "../request-context";
import { createBetterAuth, isBetterAuthConfigured } from "../auth";
import { type ObservabilityHonoEnv, wideEventFields } from "../observability";

export function registerAuthRoutes(
  app: Hono<ObservabilityHonoEnv>,
  resolveRequestApp: ResolveRequestApp,
) {
  const authRoute = wideEventFields({ routeName: "api.auth" });

  app.post(
    "/__internal/auth/test-account",
    wideEventFields({ routeName: "internal.auth.seed" }),
    async (c) => {
      const { appServices } = await resolveRequestApp(c);
      const configuredSecret = appServices.env.AUTH_SEED_SECRET;
      const providedSecret = c.req.header("x-lares-seed-secret");
      if (!configuredSecret || providedSecret !== configuredSecret) {
        return c.notFound();
      }

      const body = await c.req.json<{
        readonly email?: string;
        readonly name?: string;
        readonly password?: string;
      }>();
      if (!body.email || !body.name || !body.password) {
        return c.json({ error: "email, name, and password are required" }, 400);
      }

      await createBetterAuth(appServices.env, { allowSignUpForSeed: true }).api.signUpEmail({
        body: {
          email: body.email,
          name: body.name,
          password: body.password,
        },
      });

      return c.json({ created: true });
    },
  );

  app.get("/api/auth/passkey/generate-register-options", authRoute, async (c) => {
    const { appServices } = await resolveRequestApp(c);
    if (!isBetterAuthConfigured(appServices.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(appServices.env);
    const authenticatorAttachment = readAuthenticatorAttachment(
      c.req.query("authenticatorAttachment"),
    );
    return runBetterAuthApi(c, () =>
      auth.api.generatePasskeyRegistrationOptions({
        asResponse: true,
        headers: c.req.raw.headers,
        query: {
          ...(authenticatorAttachment ? { authenticatorAttachment } : {}),
          ...(c.req.query("context") ? { context: c.req.query("context") } : {}),
          ...(c.req.query("name") ? { name: c.req.query("name") } : {}),
        },
      }),
    );
  });

  app.post("/api/auth/passkey/verify-registration", authRoute, async (c) => {
    const { appServices } = await resolveRequestApp(c);
    if (!isBetterAuthConfigured(appServices.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(appServices.env);
    return runBetterAuthApi(c, async () =>
      auth.api.verifyPasskeyRegistration({
        asResponse: true,
        body: await c.req.json(),
        headers: c.req.raw.headers,
      }),
    );
  });

  app.get("/api/auth/passkey/generate-authenticate-options", authRoute, async (c) => {
    const { appServices } = await resolveRequestApp(c);
    if (!isBetterAuthConfigured(appServices.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(appServices.env);
    return runBetterAuthApi(c, () =>
      auth.api.generatePasskeyAuthenticationOptions({
        asResponse: true,
        headers: c.req.raw.headers,
      }),
    );
  });

  app.post("/api/auth/passkey/verify-authentication", authRoute, async (c) => {
    const { appServices } = await resolveRequestApp(c);
    if (!isBetterAuthConfigured(appServices.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(appServices.env);
    return runBetterAuthApi(c, async () =>
      auth.api.verifyPasskeyAuthentication({
        asResponse: true,
        body: await c.req.json(),
        headers: c.req.raw.headers,
      }),
    );
  });

  app.on(["GET", "POST"], "/api/auth/*", authRoute, async (c) => {
    const { appServices } = await resolveRequestApp(c);
    if (!isBetterAuthConfigured(appServices.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    if (c.req.path.startsWith("/api/auth/passkey/")) {
      const url = new URL(c.req.url);
      url.pathname = url.pathname.replace("/api/auth", "");
      return createBetterAuth(appServices.env).handler(new Request(url, c.req.raw));
    }

    return createBetterAuth(appServices.env).handler(c.req.raw);
  });
}

async function runBetterAuthApi<T>(c: HonoHandlerContext, run: () => Promise<T>) {
  try {
    const result = await run();
    if (result instanceof Response) return result;
    return c.json(result);
  } catch (error) {
    const status = readErrorStatus(error);
    return new Response(JSON.stringify({ error: readErrorMessage(error) }), {
      headers: { "content-type": "application/json" },
      status,
    });
  }
}

function readErrorStatus(error: unknown) {
  const status = readObjectProperty(error, "status");
  if (typeof status === "number" && status >= 400 && status < 600) {
    return status;
  }
  const statusCode = readObjectProperty(error, "statusCode");
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) {
    return statusCode;
  }
  return 401;
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Authentication failed";
}

function readAuthenticatorAttachment(value: string | undefined) {
  return value === "platform" || value === "cross-platform" ? value : undefined;
}
