// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VariableBrowser from "../../../../../src/client/shared/ui/variable-field/VariableBrowser";
import type { VariableDescriptor } from "../../../../../src/client/shared/ui/variable-field/types";

// jsdom lacks ResizeObserver (used by Radix ScrollArea); stub it so renders don't throw.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const vars: VariableDescriptor[] = [
  { token: "{user}", example: "@Ada", group: "user", description: "User mention" },
  { token: "{server}", example: "Acme", group: "server", description: "Server name" },
];

describe("VariableBrowser", () => {
  it("opens, filters, and inserts a token", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<VariableBrowser variables={vars} onInsert={onInsert} />);
    await user.click(screen.getByRole("button"));
    const search = screen.getByRole("searchbox");
    await user.type(search, "serv");
    await user.click(screen.getByText("{server}"));
    expect(onInsert).toHaveBeenCalledWith("{server}");
  });
});
