/// <reference types="@testing-library/jest-dom/vitest" />
//
// Pins Task 6 (and fix round 1's Critical #1): Create Game moves OUT of the workspace bar (where
// the site's home model used to hand it over via `SiteHomeModel.action`, a sibling subtree with
// no view of this component's state) and INTO the home bar — not via a `HomeBarPortal` of its
// own (that was round 1's bug: `ResourceExplorer` already publishes one, so a second one from
// this component landed two `HomeBar`s in the same strip), but by handing the button to
// `ResourceExplorer` as `homeBarRight`, which is the ONLY thing that ever calls `HomeBarPortal`
// for this feature now. `HomeBarHost` is mounted above the feature exactly as `SiteHomeShell`
// mounts it in the real fleet — see resource-explorer.homeBar.test.tsx, whose harness (the router
// mock, and wrapping a publisher in a real `HomeBarHost` so `HomeBarPortal` doesn't take its
// no-host inline fallback) this file reuses. The API mocks are TeamsFeature.test.tsx's pattern:
// only the data subpaths (`games`, `ecosystems`) and `next/navigation` are doubled, and
// `useResourceList` / `useResourceItemQuery` run for real against them.
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

// Deliberately UNFORGEABLE, the same reasoning as siteHomeRoute.test.tsx's `SHELL_SCOPE`: a
// slug-shaped `workspaceSlug` an implementation could plausibly derive an href from, paired with
// a `basePath` that shares no substring with it. An assertion that the Create Game link's href
// starts with `BASE_PATH` can only pass if the component actually read `basePath` — reading
// `workspaceSlug` instead, or building `/${workspaceSlug}`, produces a visibly wrong href, not a
// coincidentally-right one.
const BASE_PATH = "/base-only-create-game-should-see";
const WORKSPACE_SLUG = "unrelated-workspace-slug";

/** Standalone mode, the way a site's home-model mounts this feature: no RailHostContext above
 *  it, so ResourceExplorer becomes its own rail host (see resource-explorer-standalone.test.tsx),
 *  and a real `HomeBarHost` above it, the way SiteHomeShell mounts one in the real fleet. */
function renderGamesFeature({
  basePath = BASE_PATH,
  workspaceSlug = WORKSPACE_SLUG,
  games = [],
}: { basePath?: string; workspaceSlug?: string; games?: Game[] } = {}) {
  listMock.mockResolvedValue(games);
  return render(
    <HomeBarHost>
      <GamesFeature basePath={basePath} workspaceSlug={workspaceSlug} />
    </HomeBarHost>,
  );
}

describe("GamesFeature's Create Game reaches the home bar through ResourceExplorer", () => {
  it("renders Create Game in the home bar, WITH the filter field before it, when games exist", async () => {
    renderGamesFeature({ games: [{ id: "g1", name: "Alpha", slug: "alpha" } as Game] });
    const strip = await screen.findByTestId("home-bar");
    const createLink = screen.getByRole("link", { name: /Create Game/ });
    expect(strip).toContainElement(createLink);
    // `HomeBarHost` draws exactly one `home-bar` div by construction (one slot, shared by every
    // claimant), so a bare element-count assertion can't tell a single combined
    // `<HomeBar left right>` apart from round 1's actual bug — a second, GamesFeature-mounted
    // `HomeBarPortal` beside ResourceExplorer's own, both portaling into that same slot. What DID
    // differ, and is what broke the layout (`[……][Create Game][Filter…]`, both flushed right): the
    // second portal's `right` (an `ml-auto` cluster) mounted BEFORE ResourceExplorer's own `left`,
    // instead of after it. `ResourceExplorer` publishes a filter field whenever it has entities to
    // filter (see resource-explorer.tsx `hasEntities`) — games ≥ 1 satisfies that — so this games
    // list must produce a searchbox, and it must precede Create Game in the DOM: true only when
    // one `<HomeBar left right>` call decides both slots at once, as `homeBarRight` now guarantees.
    const field = screen.getByRole("searchbox");
    expect(strip).toContainElement(field);
    expect(field.compareDocumentPosition(createLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("still renders Create Game in the home bar with zero games, and with NO filter field", async () => {
    renderGamesFeature({ games: [] });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("link", { name: /Create Game/ }));
    // Zero games means ResourceExplorer's `hasEntities` is false, so no filter field — there is
    // nothing loaded to filter. `homeBarRight` alone is what keeps the bar itself published here.
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("links Create Game at the feature's OWN basePath, not the workspace slug", async () => {
    renderGamesFeature({ basePath: BASE_PATH, workspaceSlug: WORKSPACE_SLUG, games: [] });
    expect(await screen.findByRole("link", { name: /Create Game/ })).toHaveAttribute(
      "href",
      `${BASE_PATH}/new`,
    );
  });
});
