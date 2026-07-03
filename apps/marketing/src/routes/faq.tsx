import { createFileRoute } from "@tanstack/react-router";
import { MarketingFaqPage } from "../components/MarketingFaqPage";
import { faqLinks, faqMeta } from "../seo";

export const Route = createFileRoute("/faq")({
  head: () => ({
    links: faqLinks(),
    meta: faqMeta(),
  }),
  component: MarketingFaqPage,
});
