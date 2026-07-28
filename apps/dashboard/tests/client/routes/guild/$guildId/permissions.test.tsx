// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ guildId: "g1" }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// PermissionsPage/RoleEditor consume several hooks from this module; only
// `usePermissionRegistry` is what this fix touches, so its result is driven
// per-test via a mutable `vi.hoisted` box while the rest stay fixed at a
// steady "everything else already loaded" shape. Mocking the whole module
// (rather than wrapping in QueryClientProvider) keeps this a pure render
// test of the loading/error/empty/loaded branching added around the grid.
interface RegistryQueryState {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
}

const registryState = vi.hoisted((): { box: RegistryQueryState } => ({
  box: {
    data: undefined,
    isLoading: false,
    isError: false,
  },
}));

const ROLE = {
  id: "role-1",
  name: "Moderators",
  color: "#a3a6ff",
  position: 0,
  isDefault: false,
  permissions: [],
  memberCount: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("../../../../../src/client/features/permissions/hooks/usePermissions", () => ({
  usePermissions: () => ({ isOwner: true, isLoading: false }),
  useDashboardRoles: () => ({ data: [ROLE], isLoading: false }),
  useCreateDashboardRole: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDashboardRole: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDashboardRole: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRoleFromPreset: () => ({ mutate: vi.fn(), isPending: false }),
  useDashboardSettings: () => ({
    data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
    isLoading: false,
  }),
  useUpdateDashboardSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useDashboardAuditLog: () => ({ data: { entries: [], total: 0, page: 1, pages: 1 }, isLoading: false }),
  usePermissionRegistry: () => registryState.box,
}));

import { PermissionsPage } from "../../../../../src/client/routes/guild/$guildId/permissions";

// Radix ScrollArea (wrapping the permission grid) needs ResizeObserver, which
// jsdom lacks. Typed against the DOM lib interface so no cast is needed.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= ResizeObserverStub;
});

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

describe("PermissionsPage — permission registry loading/error/empty states", () => {
  it("shows a skeleton and no grid or error while the registry is loading", async () => {
    registryState.box = { data: undefined, isLoading: true, isError: false };
    render(<PermissionsPage />);

    // Auto-select of the role happens post-mount; wait for the editor to appear.
    expect(await screen.findByTestId("permission-registry-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-empty")).not.toBeInTheDocument();
    expect(screen.queryByText("permissions:permissionCategories.tickets")).not.toBeInTheDocument();
  });

  it("shows a visible error state and no grid or skeleton when the registry fails to load", async () => {
    registryState.box = { data: undefined, isLoading: false, isError: true };
    render(<PermissionsPage />);

    const alert = await screen.findByTestId("permission-registry-error");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("roleEditor.registryError");
    expect(screen.queryByTestId("permission-registry-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-empty")).not.toBeInTheDocument();
  });

  it("renders the grid, with neither the skeleton nor the error, once the registry loads", async () => {
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    render(<PermissionsPage />);

    expect(await screen.findByText("permissions:permissionCategories.tickets")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-empty")).not.toBeInTheDocument();
  });

  it("distinguishes a successfully-loaded empty registry from the error state", async () => {
    registryState.box = { data: [], isLoading: false, isError: false };
    render(<PermissionsPage />);

    const empty = await screen.findByTestId("permission-registry-empty");
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent("roleEditor.registryEmpty");
    expect(screen.queryByTestId("permission-registry-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-loading")).not.toBeInTheDocument();
  });
});
