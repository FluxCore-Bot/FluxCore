import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../lib/client";
import { UserSchema, type User } from "../lib/schemas";

export function useAuth() {
  return useQuery<User | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const res = await fetch("/auth/me");
        if (res.status === 401) return null;
        if (!res.ok) throw new ApiError(res.status, "Failed to fetch user");
        const data = await res.json();
        return UserSchema.parse(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
