import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateGameAction } from "../CreateGameAction";

// The button NAVIGATES rather than signalling React state: GamesFeature's `creating` is itself
// derived from the URL by `parseGamesPath`, not from a component's `useState`, so there is
// nothing for a click handler to set directly. The URL is the whole channel, which is why the
// assertion here is on the href.
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
