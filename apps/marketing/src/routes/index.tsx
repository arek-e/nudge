import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "../components/MarketingHome";

export const Route = createFileRoute("/")({
  component: MarketingHome,
});
