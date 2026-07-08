import { describe, it, expect } from "vitest";
import { resolveTemplatePreview } from "../../../../../src/client/shared/ui/variable-field/resolvePreview";

const values = new Map<string, string>([
  ["{user}", "@Ada"],
  ["{user.name}", "Ada"],
  ["{server}", "Acme"],
  ["{membercount}", "1,234"],
]);

describe("resolveTemplatePreview", () => {
  it("replaces known tokens with their values", () => {
    expect(resolveTemplatePreview("Hey {user}, welcome to {server}!", values)).toBe("Hey @Ada, welcome to Acme!");
  });
  it("does not let {user} clobber {user.name}", () => {
    expect(resolveTemplatePreview("{user} / {user.name}", values)).toBe("@Ada / Ada");
  });
  it("leaves unknown tokens visible", () => {
    expect(resolveTemplatePreview("member #{membercont}", values)).toBe("member #{membercont}");
  });
  it("replaces every occurrence", () => {
    expect(resolveTemplatePreview("{server} {server}", values)).toBe("Acme Acme");
  });
});
