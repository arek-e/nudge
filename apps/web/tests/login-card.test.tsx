import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginCard } from "@vesta/ui";

describe("LoginCard", () => {
  test("renders the shadcn login-03 shell with Vesta auth methods", () => {
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

    expect(html).toContain("Vesta");
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

  test("can render the staging beta lockup", () => {
    const html = renderToStaticMarkup(
      <LoginCard
        email="alex@example.com"
        emailOtpEnabled
        error=""
        googleEnabled={false}
        logoLongSrc="/icons/vesta-logo-long-beta.svg"
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

    expect(html).toContain('src="/icons/vesta-logo-long-beta.svg"');
  });
});
