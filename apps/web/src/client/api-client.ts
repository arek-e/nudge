import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiContract } from "../api-contract";

const link = new OpenAPILink(apiContract, {
  url: () => `${window.location.origin}/api`,
});

export const apiClient: JsonifiedClient<ContractRouterClient<typeof apiContract>> =
  createORPCClient(link);
