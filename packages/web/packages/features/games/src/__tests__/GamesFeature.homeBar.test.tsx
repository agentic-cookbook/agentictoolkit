/// <reference types="@testing-library/jest-dom/vitest" />
//
// Pins Task 6: Create Game moves OUT of the workspace bar (where the site's home model used to
// hand it over via `SiteHomeModel.action`, a sibling subtree with no view of this component's
// state) and INTO the home bar that `GamesFeature` itself publishes into with `HomeBarPortal`.
// `HomeBarHost` is mounted above the feature exactly as `SiteHomeShell` mounts it in the real
// fleet — see resource-explorer.homeBar.test.tsx, whose harness (the router mock, and wrapping a
// publisher in a real `HomeBarHost` so `HomeBarPortal` doesn't take its no-host inline fallback)
// this file reuses. The API mocks are TeamsFeature.test.tsx's pattern: only the data subpaths
// (`games`, `ecosystems`) and `next/navigation` are doubled, and `useResourceList` /
// `useResourceItemQuery` run for real against them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeBarHost } from "@agentic-toolkit/resource";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@agentic-toolkit/data/games", () => ({
  gamesApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@agentic-toolkit/data/ecosystems", () => ({
  ecosystemsApi: {
    ecosystemIdForSlug: vi.fn(),
  },
}));

import { GamesFeature } from "../GamesFeature";
import { gamesApi, type Game } from "@agentic-toolkit/data/games";
import { ecosystemsApi } from "@agentic-toolkit/data/ecosystems";

const listMock = vi.mocked(gamesApi.list);
const idForSlugMock = vi.mocked(ecosystemsApi.ecosystemIdForSlug);

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  idForSlugMock.mockResolvedValue("eco1");
});

afterEach(cleanup);

/** Standalone mode, the way a site's home-model mounts this feature: no RailHostContext above
 *  it, so ResourceExplorer becomes its own rail host (see resource-explorer-standalone.test.tsx),
 *  and a real `HomeBarHost` above it, the way SiteHomeShell mounts one in the real fleet. */
function renderGamesFeature({
  basePath = "/acme",
  games = [],
}: { basePath?: string; games?: Game[] } = {}) {
  listMock.mockResolvedValue(games);
  return render(
    <HomeBarHost>
      <GamesFeature basePath={basePath} workspaceSlug="acme" />
    </HomeBarHost>,
  );
}

describe("GamesFeature publishes Create Game into the home bar", () => {
  it("renders Create Game in the home bar", async () => {
    renderGamesFeature({ games: [{ id: "g1", name: "Alpha", slug: "alpha" } as Game] });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("link", { name: /Create Game/ }));
  });

  it("links Create Game at the feature's own /new path", async () => {
    renderGamesFeature({ basePath: "/acme", games: [] });
    expect(await screen.findByRole("link", { name: /Create Game/ })).toHaveAttribute(
      "href",
      "/acme/new",
    );
  });
});
