// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockApiFetch = vi.fn();
vi.mock("../../../../src/client/shared/lib/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { usePermissionRegistry } from "../../../../src/client/features/permissions/hooks/usePermissions";

const REGISTRY = [
  {
    key: "tickets",
    icon: "Ticket",
    labelKey: "permissions:permissionCategories.tickets",
    permissions: [
      {
        key: "tickets.list.view",
        resourceKey: "permissions:resources.list",
        actionKey: "permissions:permissionActions.view",
      },
    ],
  },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePermissionRegistry", () => {
  it("parses the served registry", async () => {
    mockApiFetch.mockResolvedValue(REGISTRY);

    const { result } = renderHook(() => usePermissionRegistry("guild-1"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(REGISTRY));
    expect(mockApiFetch).toHaveBeenCalledWith("/api/guilds/guild-1/permission-registry");
  });

  it("rejects a registry entry missing its i18n keys", async () => {
    mockApiFetch.mockResolvedValue([{ key: "tickets", icon: "Ticket", permissions: [] }]);

    const { result } = renderHook(() => usePermissionRegistry("guild-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
