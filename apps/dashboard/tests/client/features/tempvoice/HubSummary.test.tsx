// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));

import { HubSummary } from "../../../../src/client/features/tempvoice/components/HubSummary";

describe("HubSummary", () => {
  it("shows the resolved channel name and the category", () => {
    render(<HubSummary resolvedName="Ahmad's Channel" categoryName="Voice Channels" />);
    expect(screen.getByText("Ahmad's Channel")).toBeInTheDocument();
    expect(screen.getByText("Voice Channels")).toBeInTheDocument();
  });

  it("falls back to the same-category wording when no category is set", () => {
    render(<HubSummary resolvedName="Ahmad's Channel" categoryName={null} />);
    expect(screen.getByText("summary.sameCategory")).toBeInTheDocument();
  });

  it("always states the auto-delete outcome", () => {
    render(<HubSummary resolvedName="X" categoryName={null} />);
    expect(screen.getByText("summary.deletedWhenEmpty")).toBeInTheDocument();
  });
});
