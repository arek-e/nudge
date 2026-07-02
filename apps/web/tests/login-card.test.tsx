import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginCard } from "@vesta/ui";

describe("LoginCard", () => {
  test("renders the shadcn login-03 shell with Nudge auth methods", () => {
    const html = renderToStaticMarkup(
      <LoginCard
        email="alex@example.com"
        emailOtpEnabled
        error=""
        googleEnabled={false}
        passkeyEnabled
        pendingEmail={false}
        pendingPasskey={false}
        sentTo=""
        otp=""
        onEmailChange={() => {}}
        onGoogle={() => {}}
        onOtpChange={() => {}}
        onPasskey={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("Nudge");
    expect(html).toContain('src="/icons/nudge-logo-lockup-blobby-n-transparent.svg"');
    expect(html).not.toContain("/icons/vesta-logo");
    expect(html).toContain("Welcome back");
    expect(html).toContain("Sign in with a passkey, Google, or an email code.");
    expect(html).toContain("Continue with passkey");
    expect(html).toContain("alex@example.com");
    expect(html.indexOf("Email")).toBeLessThan(html.indexOf("Continue with passkey"));
    expect(html).toContain('title="Continue with passkey"');
    expect(html).toContain('aria-label="Gmail unavailable"');
    expect(html).toContain('title="Gmail sign-in unavailable"');
    expect(html).toContain('viewBox="52 42 88 66"');
    expect(html).toContain('fill="#4285f4"');
    expect(html).not.toContain("Continue with Google");
  });
});
