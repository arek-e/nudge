import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "../components/MarketingHome";
import { homeLinks, homeMeta } from "../seo";

export const Route = createFileRoute("/")({
  head: () => ({
    links: homeLinks(),
    meta: homeMeta(),
  }),
  component: MarketingHome,
});
