import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { marketingRootRedirectTarget } from "../auth-redirect";
import { MarketingHome } from "../components/MarketingHome";
import { homeLinks, homeMeta } from "../seo";

const getMarketingRootRedirectTarget = createServerFn({ method: "GET" }).handler(async () =>
  marketingRootRedirectTarget({
    clerkClientUat: getCookie("__client_uat"),
    clerkSession: getCookie("__session"),
  }),
);

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const href = await getMarketingRootRedirectTarget();
    if (href) throw redirect({ href, statusCode: 302 });
  },
  head: () => ({
    links: homeLinks(),
    meta: homeMeta(),
  }),
  component: MarketingHome,
});
