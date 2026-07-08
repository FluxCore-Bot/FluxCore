// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../../../../../src/client/shared/hooks/useAuth", () => ({
  useAuth: () => ({ data: { userId: "7", username: "Ada", avatar: "def" } }),
}));
vi.mock("../../../../../src/client/shared/hooks/useGuilds", () => ({
  useGuilds: () => ({ data: [{ id: "42", name: "Acme", icon: "abc" }] }),
}));

import { usePreviewContext } from "../../../../../src/client/shared/ui/variable-field/usePreviewContext";

describe("usePreviewContext", () => {
  it("assembles real data from the matching guild and current user", () => {
    const { result } = renderHook(() => usePreviewContext("42"));
    expect(result.current.serverName).toBe("Acme");
    expect(result.current.userName).toBe("Ada");
  });
  it("falls back to defaults when the guild is not found", () => {
    const { result } = renderHook(() => usePreviewContext("999"));
    expect(result.current.serverName).toBe("My Server");
  });
});
