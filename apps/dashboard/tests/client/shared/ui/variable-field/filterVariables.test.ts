import { describe, it, expect } from "vitest";
import { filterByQuery } from "../../../../../src/client/shared/ui/variable-field/filterVariables";
import type { VariableDescriptor } from "../../../../../src/client/shared/ui/variable-field/types";

const vars: VariableDescriptor[] = [
  { token: "{user}", example: "@Ada", group: "user" },
  { token: "{user.name}", example: "Ada", group: "user" },
  { token: "{server}", example: "Acme", group: "server" },
];

describe("filterByQuery", () => {
  it("returns all descriptors for an empty query", () => {
    expect(filterByQuery(vars, "")).toHaveLength(3);
  });
  it("matches by substring, case-insensitively", () => {
    expect(filterByQuery(vars, "USER").map((v) => v.token)).toEqual(["{user}", "{user.name}"]);
  });
  it("ranks prefix matches before mid-string matches", () => {
    expect(filterByQuery(vars, "ser").map((v) => v.token)).toEqual(["{server}", "{user}", "{user.name}"]);
  });
  it("returns [] when nothing matches", () => {
    expect(filterByQuery(vars, "zzz")).toEqual([]);
  });
});
