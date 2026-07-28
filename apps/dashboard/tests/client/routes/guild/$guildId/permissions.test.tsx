// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

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

// Mirrors registryState: a mutable box so individual tests can drive which
// permissions the selected role starts with, since RoleEditor seeds its
// local permissions Set straight from role.permissions on mount.
interface RoleFixture {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  permissions: string[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

const ROLE_BASE: RoleFixture = {
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

const roleState = vi.hoisted((): { box: RoleFixture } => ({
  box: {
    id: "role-1",
    name: "Moderators",
    color: "#a3a6ff",
    position: 0,
    isDefault: false,
    permissions: [],
    memberCount: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
}));

vi.mock("../../../../../src/client/features/permissions/hooks/usePermissions", async (importOriginal) => {
  // matchPermission is kept real (rather than re-stubbed) so RoleEditor's
  // lookups-warning check — which imports it via lookupsWarning.ts — behaves
  // exactly as it does outside tests; everything else here is a fixed mock.
  const actual =
    await importOriginal<typeof import("../../../../../src/client/features/permissions/hooks/usePermissions")>();
  return {
    matchPermission: actual.matchPermission,
    usePermissions: () => ({ isOwner: true, isLoading: false }),
    useDashboardRoles: () => ({ data: [roleState.box], isLoading: false }),
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
  };
});

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

const REGISTRY_WITH_DASHBOARD = [
  ...REGISTRY,
  {
    key: "dashboard",
    icon: "Shield",
    labelKey: "permissions:permissionCategories.dashboard",
    permissions: [
      {
        key: "dashboard.roles.manage",
        resourceKey: "permissions:resources.roles",
        actionKey: "permissions:permissionActions.manage",
      },
      {
        key: "dashboard.lookups.view",
        resourceKey: "permissions:resources.lookups",
        actionKey: "permissions:permissionActions.view",
      },
    ],
  },
];

describe("PermissionsPage — lookups warning and admission note", () => {
  it("warns when the role can manage something but cannot use pickers", async () => {
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.roles.manage"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    render(<PermissionsPage />);

    const warning = await screen.findByTestId("lookups-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent("roleEditor.lookupsWarning");
  });

  it("stays quiet once the role also holds dashboard.lookups.view directly", async () => {
    roleState.box = {
      ...ROLE_BASE,
      permissions: ["dashboard.roles.manage", "dashboard.lookups.view"],
    };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    render(<PermissionsPage />);

    // Anchor on the loaded grid so the assertion below isn't racing the fetch.
    await screen.findByText("permissions:permissionCategories.dashboard");
    expect(screen.queryByTestId("lookups-warning")).not.toBeInTheDocument();
  });

  it("stays quiet when a dashboard.* wildcard already covers lookups", async () => {
    // Proves the check goes through matchPermission's wildcard handling
    // rather than a plain Set.has("dashboard.lookups.view").
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.*"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    render(<PermissionsPage />);

    await screen.findByText("permissions:permissionCategories.dashboard");
    expect(screen.queryByTestId("lookups-warning")).not.toBeInTheDocument();
  });

  it("clears the warning once Grant picker access is clicked", async () => {
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.roles.manage"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    render(<PermissionsPage />);

    expect(await screen.findByTestId("lookups-warning")).toBeInTheDocument();

    fireEvent.click(screen.getByText("roleEditor.grantLookups"));

    expect(screen.queryByTestId("lookups-warning")).not.toBeInTheDocument();
  });

  it("renders the admission note beside dashboard.roles.manage when it is offered", async () => {
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.lookups.view"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    render(<PermissionsPage />);

    const permKey = await screen.findByText("dashboard.roles.manage");
    const row = permKey.parentElement;
    if (!row) throw new Error("expected dashboard.roles.manage to render inside a container element");
    expect(within(row).getByText("roleEditor.admissionNote")).toBeInTheDocument();
  });

  it("does not render the admission note when dashboard.roles.manage is not offered", async () => {
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    render(<PermissionsPage />);

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(screen.queryByText("roleEditor.admissionNote")).not.toBeInTheDocument();
  });
});
