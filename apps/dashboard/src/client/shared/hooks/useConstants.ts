import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/client";
import { ConstantsSchema, type Constants } from "../lib/schemas";

export function useConstants() {
  return useQuery<Constants>({
    queryKey: ["actions", "constants"],
    queryFn: async () => {
      const data = await apiFetch<unknown>("/api/actions/constants");
      return ConstantsSchema.parse(data);
    },
    staleTime: Infinity,
  });
}
