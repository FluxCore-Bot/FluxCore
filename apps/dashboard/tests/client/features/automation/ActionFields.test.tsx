// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionFields } from "../../../../src/client/features/automation/components/ActionFields";
import type { ActionFieldDescriptor } from "../../../../src/client/shared/lib/schemas";

function translate(key: string, opts?: Record<string, unknown>): string {
  return opts ? `${key}:${JSON.stringify(opts)}` : key;
}
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { dir: () => "ltr" } }),
}));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const headersField: ActionFieldDescriptor[] = [
  { key: "webhook.headers", label: "Headers (JSON)", type: "json", maxLength: 1000 },
];

function renderHeaders(values: Record<string, unknown>, onChange = vi.fn()) {
  render(
    <ActionFields
      fields={headersField}
      values={values}
      onChange={onChange}
      channels={[]}
      roles={[]}
      variables={[]}
    />,
  );
  return onChange;
}

/**
 * `webhook.headers` is typed as a record, but the field wrote the raw textarea
 * string straight into it. Typing the exact JSON the placeholder shows
 * produced "Expected object, received string" on save — English-only, naming
 * no field and no node — and nothing the user could type would ever save.
 * The reverse was as bad: a rule that already had headers opened showing the
 * literal text "[object Object]", and saving overwrote the real headers.
 */
describe("ActionFields — JSON fields", () => {
  it("shows an existing header object as formatted JSON, not [object Object]", () => {
    renderHeaders({ webhook: { headers: { "X-Request-Id": "abc" } } });

    const field = screen.getByLabelText(/Headers/) as HTMLTextAreaElement;
    expect(field.value).toContain("X-Request-Id");
    expect(field.value).not.toContain("[object Object]");
  });

  it("commits a parsed object once the text is valid JSON", async () => {
    const onChange = renderHeaders({});

    const field = screen.getByLabelText(/Headers/);
    await userEvent.click(field);
    await userEvent.paste('{"X-Request-Id":"abc"}');

    expect(onChange).toHaveBeenLastCalledWith("webhook.headers", { "X-Request-Id": "abc" });
  });

  it("flags invalid JSON instead of committing a string", async () => {
    const onChange = renderHeaders({});

    const field = screen.getByLabelText(/Headers/);
    await userEvent.click(field);
    await userEvent.paste("{not json");

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Never hand the model a string for a field typed as a record.
    for (const call of onChange.mock.calls) {
      expect(typeof call[1]).not.toBe("string");
    }
  });

  it("rejects valid JSON that is not an object of strings", async () => {
    const onChange = renderHeaders({});

    const field = screen.getByLabelText(/Headers/);
    await userEvent.click(field);
    await userEvent.paste('["a","b"]');

    expect(field).toHaveAttribute("aria-invalid", "true");
    for (const call of onChange.mock.calls) {
      expect(Array.isArray(call[1])).toBe(false);
    }
  });

  it("clears the field to undefined rather than an empty string", async () => {
    const onChange = renderHeaders({ webhook: { headers: { a: "b" } } });

    await userEvent.clear(screen.getByLabelText(/Headers/));

    expect(onChange).toHaveBeenLastCalledWith("webhook.headers", undefined);
  });
});

describe("ActionFields — required fields are announced, not just starred", () => {
  // A red asterisk is the only signal a field is required, and nothing marks
  // it invalid once left empty — so a screen-reader user gets no feedback at
  // all about why Save is disabled.
  it("marks an empty required field invalid and links its message", () => {
    render(
      <ActionFields
        fields={[{ key: "channelId", label: "Channel", type: "text", required: true }]}
        values={{}}
        onChange={vi.fn()}
        channels={[]}
        roles={[]}
        variables={[]}
        showErrors
      />,
    );

    const field = screen.getByLabelText(/Channel/);
    expect(field).toHaveAttribute("aria-invalid", "true");
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(/form\.fieldRequired/);
  });

  it("says nothing when the required field is filled", () => {
    render(
      <ActionFields
        fields={[{ key: "channelId", label: "Channel", type: "text", required: true }]}
        values={{ channelId: "123" }}
        onChange={vi.fn()}
        channels={[]}
        roles={[]}
        variables={[]}
        showErrors
      />,
    );

    expect(screen.getByLabelText(/Channel/)).not.toHaveAttribute("aria-invalid", "true");
  });
});
