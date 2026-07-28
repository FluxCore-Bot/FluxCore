// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LogFilters } from "../../../../src/client/features/logging/hooks/useLogging";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}:${JSON.stringify(o)}` : k,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ guildId: "g1" }),
}));

const capturedFilters: LogFilters[] = [];
vi.mock("../../../../src/client/features/logging/hooks/useLogging", () => ({
  useLogEntries: (_guildId: string, filters: LogFilters) => {
    capturedFilters.push(filters);
    return {
      data: {
        entries: [
          {
            id: "e1",
            category: "member",
            eventType: "memberJoin",
            targetId: "u1",
            executorId: null,
            createdAt: new Date(0).toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      },
      isLoading: false,
    };
  },
}));

import { EventLogBrowser } from "../../../../src/client/features/logging/components/EventLogBrowser";

// Radix select needs these APIs, which jsdom lacks.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= ResizeObserverStub;
  Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};
  Element.prototype.hasPointerCapture ??= function hasPointerCapture(): boolean {
    return false;
  };
  Element.prototype.releasePointerCapture ??=
    function releasePointerCapture(): void {};
});

describe("EventLogBrowser", () => {
  it("renders the browser and its category filter without throwing", () => {
    render(<EventLogBrowser />);
    expect(screen.getByText("events.title")).toBeInTheDocument();
    expect(screen.getByText("memberJoin")).toBeInTheDocument();
  });

  it("sends no category param while the all-categories option is selected", async () => {
    const user = userEvent.setup();
    capturedFilters.length = 0;
    render(<EventLogBrowser />);

    await user.click(screen.getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: "events.filter.allCategories" }),
    );

    expect(capturedFilters.at(-1)?.category).toBeUndefined();
  });
});
