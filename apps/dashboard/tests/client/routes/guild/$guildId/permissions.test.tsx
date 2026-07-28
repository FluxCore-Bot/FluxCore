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

// Drives the current user's own resolved permissions/isOwner as returned by
// usePermissions(guildId) — consumed both by PermissionsPage's gates (Create
// Role button, audit tab) and by RoleEditor's per-checkbox escalation guard.
interface PermissionsFixture {
  isOwner: boolean;
  isLoading: boolean;
  permissions: string[];
}

const permissionsState = vi.hoisted((): { box: PermissionsFixture } => ({
  box: { isOwner: true, isLoading: false, permissions: ["*"] },
}));

// Drives useDashboardSettings(guildId) — in particular isError, to exercise
// the "settings fetch 403s" path a dashboard.roles.view-only viewer hits.
interface SettingsFixture {
  data: { guildId: string; auditRetentionDays: number; requirePermissions: boolean } | undefined;
  isLoading: boolean;
  isError: boolean;
}

const settingsState = vi.hoisted((): { box: SettingsFixture } => ({
  box: {
    data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
    isLoading: false,
    isError: false,
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
    usePermissions: () => ({
      isOwner: permissionsState.box.isOwner,
      isLoading: permissionsState.box.isLoading,
      permissions: permissionsState.box.permissions,
      can: (key: string) =>
        permissionsState.box.isOwner ||
        actual.matchPermission(new Set(permissionsState.box.permissions), key),
    }),
    useDashboardRoles: () => ({ data: [roleState.box], isLoading: false }),
    useCreateDashboardRole: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateDashboardRole: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteDashboardRole: () => ({ mutate: vi.fn(), isPending: false }),
    useCreateRoleFromPreset: () => ({ mutate: vi.fn(), isPending: false }),
    useDashboardSettings: () => settingsState.box,
    useUpdateDashboardSettings: () => ({ mutate: vi.fn(), isPending: false }),
    useDashboardAuditLog: () => ({ data: { entries: [], total: 0, page: 1, pages: 1 }, isLoading: false }),
    usePermissionRegistry: () => registryState.box,
  };
});

import { PermissionsPage } from "../../../../../src/client/routes/guild/$guildId/permissions";
import { TooltipProvider } from "../../../../../src/client/shared/ui/tooltip";

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

// Production wraps every route in a root-level TooltipProvider (routes/__root.tsx);
// RoleEditor's escalation-guard tooltips (Fix 3) rely on that context being present,
// so tests reproduce it here rather than have the component special-case its absence.
function renderPage() {
  return render(
    <TooltipProvider>
      <PermissionsPage />
    </TooltipProvider>,
  );
}

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
    renderPage();

    // Auto-select of the role happens post-mount; wait for the editor to appear.
    expect(await screen.findByTestId("permission-registry-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-empty")).not.toBeInTheDocument();
    expect(screen.queryByText("permissions:permissionCategories.tickets")).not.toBeInTheDocument();
  });

  it("shows a visible error state and no grid or skeleton when the registry fails to load", async () => {
    registryState.box = { data: undefined, isLoading: false, isError: true };
    renderPage();

    const alert = await screen.findByTestId("permission-registry-error");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("roleEditor.registryError");
    expect(screen.queryByTestId("permission-registry-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-empty")).not.toBeInTheDocument();
  });

  it("renders the grid, with neither the skeleton nor the error, once the registry loads", async () => {
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    expect(await screen.findByText("permissions:permissionCategories.tickets")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-registry-empty")).not.toBeInTheDocument();
  });

  it("distinguishes a successfully-loaded empty registry from the error state", async () => {
    registryState.box = { data: [], isLoading: false, isError: false };
    renderPage();

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
    renderPage();

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
    renderPage();

    // Anchor on the loaded grid so the assertion below isn't racing the fetch.
    await screen.findByText("permissions:permissionCategories.dashboard");
    expect(screen.queryByTestId("lookups-warning")).not.toBeInTheDocument();
  });

  it("stays quiet when a dashboard.* wildcard already covers lookups", async () => {
    // Proves the check goes through matchPermission's wildcard handling
    // rather than a plain Set.has("dashboard.lookups.view").
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.*"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.dashboard");
    expect(screen.queryByTestId("lookups-warning")).not.toBeInTheDocument();
  });

  it("clears the warning once Grant picker access is clicked", async () => {
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.roles.manage"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    renderPage();

    expect(await screen.findByTestId("lookups-warning")).toBeInTheDocument();

    fireEvent.click(screen.getByText("roleEditor.grantLookups"));

    expect(screen.queryByTestId("lookups-warning")).not.toBeInTheDocument();
  });

  it("renders the admission note beside dashboard.roles.manage when it is offered", async () => {
    roleState.box = { ...ROLE_BASE, permissions: ["dashboard.lookups.view"] };
    registryState.box = { data: REGISTRY_WITH_DASHBOARD, isLoading: false, isError: false };
    renderPage();

    const permKey = await screen.findByText("dashboard.roles.manage");
    const row = permKey.parentElement;
    if (!row) throw new Error("expected dashboard.roles.manage to render inside a container element");
    expect(within(row).getByText("roleEditor.admissionNote")).toBeInTheDocument();
  });

  it("does not render the admission note when dashboard.roles.manage is not offered", async () => {
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(screen.queryByText("roleEditor.admissionNote")).not.toBeInTheDocument();
  });
});

describe("PermissionsPage — settings fetch failure never asserts a security posture", () => {
  it("renders neither the status card nor the disabled banner when dashboard-settings 403s", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["dashboard.roles.view"] };
    settingsState.box = { data: undefined, isLoading: false, isError: true };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(screen.queryByText("permissionSystem.title")).not.toBeInTheDocument();
    expect(screen.queryByText("warning.disabled")).not.toBeInTheDocument();
  });

  it("renders the status card and disabled banner once the settings fetch succeeds", async () => {
    permissionsState.box = { isOwner: true, isLoading: false, permissions: ["*"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: false },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    expect(await screen.findByText("permissionSystem.title")).toBeInTheDocument();
    expect(screen.getByText("warning.disabled")).toBeInTheDocument();
  });
});

describe("PermissionsPage — Create Role and Audit Log gated on their own permissions", () => {
  it("hides Create Role when the caller lacks dashboard.roles.manage", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["tickets.list.view"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(screen.queryByText("actions.createRole")).not.toBeInTheDocument();
  });

  it("shows Create Role when the caller holds dashboard.roles.manage", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["dashboard.roles.manage"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    expect(await screen.findByText("actions.createRole")).toBeInTheDocument();
  });

  it("hides the Audit Log tab when the caller lacks dashboard.audit.view", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["dashboard.roles.manage"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(screen.queryByText("tabs.auditLog")).not.toBeInTheDocument();
  });

  it("shows the Audit Log tab when the caller holds dashboard.audit.view", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["dashboard.audit.view"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    renderPage();

    expect(await screen.findByText("tabs.auditLog")).toBeInTheDocument();
  });
});

const REGISTRY_MULTI_MODULE = [
  ...REGISTRY,
  {
    key: "moderation",
    icon: "Shield",
    labelKey: "permissions:permissionCategories.moderation",
    permissions: [
      {
        key: "moderation.cases.view",
        resourceKey: "permissions:resources.cases",
        actionKey: "permissions:permissionActions.view",
      },
    ],
  },
];

function checkboxForPermissionKey(keyText: string): HTMLElement {
  const el = screen.getByText(keyText);
  const label = el.closest("label");
  if (!label) throw new Error(`expected ${keyText} to render inside a <label>`);
  return within(label).getByRole("checkbox");
}

describe("PermissionsPage — RoleEditor disables permissions the current user cannot grant", () => {
  it("enables checkboxes within the caller's own grant and disables the rest, with a delegated (non-owner) caller", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["tickets.*"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY_MULTI_MODULE, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(checkboxForPermissionKey("tickets.list.view")).not.toBeDisabled();
    expect(checkboxForPermissionKey("moderation.cases.view")).toBeDisabled();
  });

  it("enables every checkbox for the owner regardless of their own resolved permissions", async () => {
    permissionsState.box = { isOwner: true, isLoading: false, permissions: [] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY_MULTI_MODULE, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(checkboxForPermissionKey("tickets.list.view")).not.toBeDisabled();
    expect(checkboxForPermissionKey("moderation.cases.view")).not.toBeDisabled();
  });
});
