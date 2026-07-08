// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import VariableEditor from "../../../../../src/client/shared/ui/variable-field/VariableEditor";
import type { VariableDescriptor } from "../../../../../src/client/shared/ui/variable-field/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.suggestion ? `${k}:${o.suggestion}` : k) }),
}));

const vars: VariableDescriptor[] = [
  { token: "{user}", example: "@Ada", group: "user", description: "User mention" },
  { token: "{user.name}", example: "Ada", group: "user", description: "Username" },
  { token: "{server}", example: "Acme", group: "server", description: "Server name" },
];

function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <VariableEditor value={v} onChange={setV} variables={vars} aria-label="field" />;
}

describe("VariableEditor", () => {
  it("opens the suggestion list when typing '{' and inserts on Enter", async () => {
    const user = userEvent.setup();
    let current = "";
    const onChange = (val: string) => { current = val; };
    render(<VariableEditor value="" onChange={onChange} variables={vars} aria-label="field" />);
    const input = screen.getByLabelText("field");
    await user.click(input);
    await user.type(input, "{{");
    // listbox appears
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(current).toContain("{user}");
  });

  it("shows an unknown-variable warning with a suggestion", () => {
    render(<VariableEditor value="hi {membercont}" onChange={() => {}} variables={[{ token: "{membercount}", example: "1,234", group: "server" }]} aria-label="field" />);
    expect(screen.getByText(/variableField\.didYouMean/)).toBeTruthy();
  });
});
