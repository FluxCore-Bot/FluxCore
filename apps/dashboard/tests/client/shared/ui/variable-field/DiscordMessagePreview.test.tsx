// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DiscordMessagePreview from "../../../../../src/client/shared/ui/variable-field/DiscordMessagePreview";
import { welcomeVariables, buildRealData } from "../../../../../src/client/shared/ui/variable-field/registry";

const real = buildRealData({ id: "42", name: "Acme", icon: null }, { userId: "7", username: "Ada", avatar: null });

describe("DiscordMessagePreview", () => {
  it("renders resolved message content", () => {
    render(<DiscordMessagePreview variables={welcomeVariables} real={real} content="Hey {user}, welcome to {server}!" />);
    expect(screen.getByText("Hey @Ada, welcome to Acme!")).toBeTruthy();
  });
  it("renders an embed title and description", () => {
    render(
      <DiscordMessagePreview
        variables={welcomeVariables}
        real={real}
        embed={{ title: "Welcome to {server}!", description: "Member #{membercount}" }}
      />,
    );
    expect(screen.getByText("Welcome to Acme!")).toBeTruthy();
    expect(screen.getByText("Member #1,234")).toBeTruthy();
  });
});
