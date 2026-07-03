import { createFileRoute } from "@tanstack/react-router";
import { MarketingFaqPage } from "../components/MarketingFaqPage";

export const Route = createFileRoute("/faq")({
  component: MarketingFaqPage,
});
