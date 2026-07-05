import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { rootLinks, rootMeta } from "../seo";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: rootLinks(appCss),
    meta: rootMeta(),
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument(props: { readonly children: ReactNode }) {
  useEffect(() => {
    void import("../sentry-client")
      .then(({ initializeMarketingClientSentry }) => initializeMarketingClientSentry())
      .catch(() => {});
  }, []);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
