// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// Drives useRoleMembers(guildId, roleId) — the assigned-member list rendered
// with provenance below the permission grid.
interface RoleMemberFixture {
  id: string;
  userId: string;
  assignedBy: string;
  createdAt: string;
}

interface RoleMembersQueryState {
  data: RoleMemberFixture[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

const roleMembersState = vi.hoisted((): { box: RoleMembersQueryState } => ({
  box: { data: [], isLoading: false, isError: false },
}));

// Drives useAssignRoleMember/useRemoveRoleMember. `mutate` records every call
// so tests can assert the exact {roleId, userId} sent, and synchronously
// invokes the caller's onSuccess/onError (mirroring RoleEditor's own
// success/error toast handling) so a `shouldFail` fixture can prove a failed
// mutation surfaces an error rather than looking like a success.
interface RoleMemberMutationFixture {
  isPending: boolean;
  shouldFail: boolean;
  calls: Array<{ roleId: string; userId: string }>;
  variables: { roleId: string; userId: string } | undefined;
}

function freshMutationFixture(): RoleMemberMutationFixture {
  return { isPending: false, shouldFail: false, calls: [], variables: undefined };
}

const assignMemberState = vi.hoisted((): { box: RoleMemberMutationFixture } => ({
  box: { isPending: false, shouldFail: false, calls: [], variables: undefined },
}));

const removeMemberState = vi.hoisted((): { box: RoleMemberMutationFixture } => ({
  box: { isPending: false, shouldFail: false, calls: [], variables: undefined },
}));

function mutationMock(state: { box: RoleMemberMutationFixture }) {
  return {
    isPending: state.box.isPending,
    variables: state.box.variables,
    mutate: (
      vars: { roleId: string; userId: string },
      opts?: { onSuccess?: () => void; onError?: (err: Error) => void },
    ) => {
      state.box.calls.push(vars);
      state.box.variables = vars;
      if (state.box.shouldFail) opts?.onError?.(new Error("Request failed"));
      else opts?.onSuccess?.();
    },
  };
}

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
    useRoleMembers: () => roleMembersState.box,
    useAssignRoleMember: () => mutationMock(assignMemberState),
    useRemoveRoleMember: () => mutationMock(removeMemberState),
  };
});

// Drives useMemberSearch/useMembersByIds — both return the same fixed roster
// regardless of the query/ids passed in, since filtering (excludeIds) is the
// component's own job, not the mocked hook's.
interface MemberFixture {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

const memberDirectoryState = vi.hoisted((): { box: MemberFixture[] } => ({ box: [] }));

vi.mock("../../../../../src/client/shared/hooks/useMembers", () => ({
  useMemberSearch: () => ({ data: memberDirectoryState.box, isLoading: false }),
  useMembersByIds: () => ({ data: memberDirectoryState.box, isLoading: false }),
}));

// Drives useAuth() — only `.data.userId` is consumed (RoleEditor's self-id
// for excluding the caller from their own add-control results).
interface AuthFixture {
  userId: string;
  username: string;
  avatar: string | null;
}

const authState = vi.hoisted((): { box: AuthFixture | null } => ({
  box: { userId: "u-current", username: "current", avatar: null },
}));

vi.mock("../../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: authState.box }),
}));

import { PermissionsPage } from "../../../../../src/client/routes/guild/$guildId/permissions";
import { TooltipProvider } from "../../../../../src/client/shared/ui/tooltip";
import { toast } from "sonner";

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

// The module "select all" checkbox's aria-label is `${modLabel} — ${allBadge}`;
// under the identity t() mock, t(mod.labelKey) and t("roleEditor.allBadge")
// each return their key verbatim (no options object is passed to either call).
function moduleSelectAllCheckbox(moduleLabelKey: string): HTMLElement {
  return screen.getByRole("checkbox", { name: `${moduleLabelKey} — roleEditor.allBadge` });
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

  it("disables the module select-all checkbox for a module the delegated caller cannot grant the wildcard for, and enables it for one they can", async () => {
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
    expect(moduleSelectAllCheckbox("permissions:permissionCategories.tickets")).not.toBeDisabled();
    expect(moduleSelectAllCheckbox("permissions:permissionCategories.moderation")).toBeDisabled();
  });

  it("enables every module select-all checkbox for the owner", async () => {
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
    expect(moduleSelectAllCheckbox("permissions:permissionCategories.tickets")).not.toBeDisabled();
    expect(moduleSelectAllCheckbox("permissions:permissionCategories.moderation")).not.toBeDisabled();
  });

  it("does not disable the select-all checkbox for a module whose wildcard is already granted, so de-escalation (un-ticking it) stays possible", async () => {
    // The role already holds the tickets.* wildcard, and the caller holds it
    // too — this is the "already fully granted" case. hasWildcard is true, so
    // the click would REMOVE the wildcard, not add it; that must stay enabled
    // even though the check only ever inspects `hasWildcard`, not `allGranted`.
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["tickets.*"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: ["tickets.*"] };
    registryState.box = { data: REGISTRY_MULTI_MODULE, isLoading: false, isError: false };
    renderPage();

    await screen.findByText("permissions:permissionCategories.tickets");
    expect(moduleSelectAllCheckbox("permissions:permissionCategories.tickets")).not.toBeDisabled();
  });
});

const ALICE: MemberFixture = { id: "u-alice", username: "alice", displayName: "Alice", avatar: null };
const BOB: MemberFixture = { id: "u-bob", username: "bob", displayName: "Bob", avatar: null };
const CURRENT: MemberFixture = { id: "u-current", username: "current", displayName: "Current", avatar: null };

function addMemberButton(): Promise<HTMLElement> {
  return screen.findByRole("button", { name: "roleEditor.membersSection.addPlaceholder" });
}

describe("PermissionsPage — role member assignment", () => {
  beforeEach(() => {
    roleMembersState.box = { data: [], isLoading: false, isError: false };
    assignMemberState.box = freshMutationFixture();
    removeMemberState.box = freshMutationFixture();
    memberDirectoryState.box = [ALICE, BOB, CURRENT];
    authState.box = { userId: "u-current", username: "current", avatar: null };
    permissionsState.box = { isOwner: true, isLoading: false, permissions: ["*"] };
    settingsState.box = {
      data: { guildId: "g1", auditRetentionDays: 30, requirePermissions: true },
      isLoading: false,
      isError: false,
    };
    roleState.box = { ...ROLE_BASE, permissions: [] };
    registryState.box = { data: REGISTRY, isLoading: false, isError: false };
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("renders an assigned member's resolved display name plus who assigned them and when", async () => {
    roleMembersState.box = {
      data: [{ id: "a1", userId: "u-alice", assignedBy: "u-bob", createdAt: "2026-01-05T00:00:00.000Z" }],
      isLoading: false,
      isError: false,
    };
    renderPage();

    expect(await screen.findByTestId("role-members-list")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    const expectedDate = new Date("2026-01-05T00:00:00.000Z").toLocaleDateString();
    expect(
      screen.getByText(
        `roleEditor.membersSection.assignedBy:${JSON.stringify({ name: "Bob", date: expectedDate })}`,
      ),
    ).toBeInTheDocument();
  });

  it("falls back to the raw assigner id when the assigner no longer resolves (left the guild)", async () => {
    roleMembersState.box = {
      data: [{ id: "a1", userId: "u-alice", assignedBy: "u-ghost", createdAt: "2026-01-05T00:00:00.000Z" }],
      isLoading: false,
      isError: false,
    };
    renderPage();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    const expectedDate = new Date("2026-01-05T00:00:00.000Z").toLocaleDateString();
    expect(
      screen.getByText(
        `roleEditor.membersSection.assignedBy:${JSON.stringify({ name: "u-ghost", date: expectedDate })}`,
      ),
    ).toBeInTheDocument();
  });

  it("shows a skeleton while members are loading, with no empty/error/list rendered", async () => {
    roleMembersState.box = { data: undefined, isLoading: true, isError: false };
    renderPage();

    expect(await screen.findByTestId("role-members-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("role-members-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("role-members-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("role-members-list")).not.toBeInTheDocument();
  });

  it("shows an explicit empty state, distinct from the error state, when the role has no members", async () => {
    roleMembersState.box = { data: [], isLoading: false, isError: false };
    renderPage();

    const empty = await screen.findByTestId("role-members-empty");
    expect(empty).toBeInTheDocument();
    expect(screen.queryByTestId("role-members-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("role-members-loading")).not.toBeInTheDocument();
  });

  it("shows an error state, not the empty state, when the member fetch fails", async () => {
    roleMembersState.box = { data: undefined, isLoading: false, isError: true };
    renderPage();

    const error = await screen.findByTestId("role-members-error");
    expect(error).toBeInTheDocument();
    expect(screen.queryByTestId("role-members-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("role-members-loading")).not.toBeInTheDocument();
  });

  it("calls the assign mutation with the selected role and user id when a member is picked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await addMemberButton());
    await user.click(await screen.findByText("Alice"));

    expect(assignMemberState.box.calls).toEqual([{ roleId: "role-1", userId: "u-alice" }]);
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("calls the remove mutation with the right role and user id", async () => {
    roleMembersState.box = {
      data: [{ id: "a1", userId: "u-alice", assignedBy: "u-bob", createdAt: "2026-01-05T00:00:00.000Z" }],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    const removeButton = screen.getByRole("button", {
      name: `roleEditor.membersSection.removeAria:${JSON.stringify({ name: "Alice" })}`,
    });
    await user.click(removeButton);

    expect(removeMemberState.box.calls).toEqual([{ roleId: "role-1", userId: "u-alice" }]);
  });

  it("disables the add control for a delegated caller who cannot grant every permission the role holds", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["tickets.list.view"] };
    roleState.box = { ...ROLE_BASE, permissions: ["moderation.cases.view"] };
    renderPage();

    expect(await addMemberButton()).toBeDisabled();
  });

  it("does not disable the add control for the owner, regardless of their own resolved permissions", async () => {
    permissionsState.box = { isOwner: true, isLoading: false, permissions: [] };
    roleState.box = { ...ROLE_BASE, permissions: ["moderation.cases.view"] };
    renderPage();

    expect(await addMemberButton()).not.toBeDisabled();
  });

  it("does not disable the add control for a delegated caller who holds every permission the role grants", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["tickets.*"] };
    roleState.box = { ...ROLE_BASE, permissions: ["tickets.list.view"] };
    renderPage();

    expect(await addMemberButton()).not.toBeDisabled();
  });

  it("excludes the current user from the add control's options for a non-owner caller", async () => {
    permissionsState.box = { isOwner: false, isLoading: false, permissions: ["tickets.*"] };
    roleState.box = { ...ROLE_BASE, permissions: ["tickets.list.view"] };
    const user = userEvent.setup();
    renderPage();

    await user.click(await addMemberButton());

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });

  it("includes the current user in the add control's options for the owner", async () => {
    permissionsState.box = { isOwner: true, isLoading: false, permissions: [] };
    const user = userEvent.setup();
    renderPage();

    await user.click(await addMemberButton());

    expect(await screen.findByText("Current")).toBeInTheDocument();
  });

  it("does not offer a member who is already assigned the role again", async () => {
    roleMembersState.box = {
      data: [{ id: "a1", userId: "u-alice", assignedBy: "u-bob", createdAt: "2026-01-05T00:00:00.000Z" }],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    renderPage();

    await user.click(await addMemberButton());

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    // "Alice" the provenance row still renders once; assert it never shows up
    // a second time inside the picker's option list.
    expect(screen.getAllByText("Alice")).toHaveLength(1);
  });

  it("surfaces an error toast, not a success toast, when the assignment fails", async () => {
    assignMemberState.box = { ...freshMutationFixture(), shouldFail: true };
    const user = userEvent.setup();
    renderPage();

    await user.click(await addMemberButton());
    await user.click(await screen.findByText("Alice"));

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("surfaces an error toast, not a success toast, when removal fails", async () => {
    roleMembersState.box = {
      data: [{ id: "a1", userId: "u-alice", assignedBy: "u-bob", createdAt: "2026-01-05T00:00:00.000Z" }],
      isLoading: false,
      isError: false,
    };
    removeMemberState.box = { ...freshMutationFixture(), shouldFail: true };
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    const removeButton = screen.getByRole("button", {
      name: `roleEditor.membersSection.removeAria:${JSON.stringify({ name: "Alice" })}`,
    });
    await user.click(removeButton);

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
