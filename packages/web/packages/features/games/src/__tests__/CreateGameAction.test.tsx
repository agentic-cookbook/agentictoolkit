import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateGameAction } from "../CreateGameAction";

// The button NAVIGATES rather than signalling React state: it renders in the workspace bar,
// a different subtree of SiteHomeShell from the feature, so there is no shared state to lift
// and ResourceExplorer exposes no external open signal. The URL is the whole channel, which
// is why the assertion here is on the href.
describe("CreateGameAction", () => {
  it("links to the workspace's reserved `new` segment", () => {
    render(<CreateGameAction basePath="/acme" />);
    expect(screen.getByRole("link", { name: /create game/i })).toHaveAttribute("href", "/acme/new");
  });

  it("does not double the slash when the base path already ends in one", () => {
    render(<CreateGameAction basePath="/acme/" />);
    expect(screen.getByRole("link", { name: /create game/i })).toHaveAttribute("href", "/acme/new");
  });
});
