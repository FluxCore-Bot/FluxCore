// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ guildId: "g1" }),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

const mockCan = vi.fn();
vi.mock("../../../../src/client/features/permissions/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: mockCan, roles: [], isLoading: false }),
}));

const mockUseAnalytics = vi.fn();
vi.mock("../../../../src/client/features/overview/hooks/useAnalytics", () => ({
  useAnalytics: (...args: unknown[]) => mockUseAnalytics(...args),
}));

vi.mock("../../../../src/client/shared/hooks/useConstants", () => ({
  useConstants: () => ({ data: undefined }),
}));

import { OverviewPage } from "../../../../src/client/routes/guild/$guildId/overview";

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAnalytics.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isFetching: false,
    });
  });

  it("shows the access summary instead of analytics without actions.analytics.view", () => {
    mockCan.mockImplementation((key: string) => key === "tickets.list.view");

    render(<OverviewPage />);

    expect(screen.getByTestId("access-summary")).toBeInTheDocument();
    expect(screen.queryByTestId("analytics-stats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analytics-error")).not.toBeInTheDocument();
  });

  it("does not fetch analytics the user cannot see", () => {
    mockCan.mockReturnValue(false);

    render(<OverviewPage />);

    expect(mockUseAnalytics).toHaveBeenCalledWith("g1", 7, false);
  });

  it("lists only the pages the user can open", () => {
    mockCan.mockImplementation((key: string) => key === "tickets.list.view");

    render(<OverviewPage />);

    const summary = screen.getByTestId("access-summary");
    expect(within(summary).getByText("common:nav.tickets")).toBeInTheDocument();
    expect(within(summary).queryByText("common:nav.moderation")).not.toBeInTheDocument();
  });

  it("renders an error state rather than an endless skeleton when analytics fails", () => {
    mockCan.mockReturnValue(true);
    mockUseAnalytics.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
    });

    render(<OverviewPage />);

    expect(screen.getByTestId("analytics-error")).toBeInTheDocument();
    expect(screen.queryByTestId("access-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analytics-stats")).not.toBeInTheDocument();
  });

  it("renders the analytics dashboard, not the access summary or an error, once permitted data has loaded", () => {
    mockCan.mockReturnValue(true);
    mockUseAnalytics.mockReturnValue({
      data: {
        summary: { totalRules: 3, activeRules: 2, totalExecutions: 10, successRate: 90, recentErrors: 0 },
        executionTrend: [],
        eventDistribution: [],
        recentActivity: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<OverviewPage />);

    expect(screen.getByTestId("analytics-stats")).toBeInTheDocument();
    expect(screen.queryByTestId("access-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analytics-error")).not.toBeInTheDocument();
  });
});
