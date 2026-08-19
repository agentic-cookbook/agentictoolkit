"use client";

import { useCallback, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, FileText, Cpu, Boxes, Waypoints, Zap } from "lucide-react";
import { ecosystemsApi } from "@agentic-toolkit/data/ecosystems";
import { clientRefusal, useResourceItemQuery, useResourceList } from "@agentic-toolkit/data";
import { gamesApi, type Game } from "@agentic-toolkit/data/games";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import {
  ResourceExplorer,
  CreateResourceDialog,
  type ResourceTopic,
} from "@agentic-toolkit/resource";
import { GameOverviewPane } from "./GameOverviewPane";
import { GameEnginePane } from "./GameEnginePane";
import { GameContentPane } from "./GameContentPane";
import { GameConnectionsPane } from "./GameConnectionsPane";
import { GameEffectsPane } from "./GameEffectsPane";
import { GameIdentityFields, gameBlank, gameValidate, gameNormalize } from "./GameDetail";
import { CreateGameAction } from "./CreateGameAction";

/**
 * The games authoring workspace: the game catalog as the top-level rail, and five topics
 * scoped to the selected game — Overview and Engine (two halves of the game's own row),
 * then Content, Connections and Effects (its three child collections).
 *
 * AUTHORING ONLY. The `game` schema's other eight tables are player state with no operator
 * read path at all, so a topic for them would render permanently empty. This site builds
 * games; it never shows who is playing them.
 *
 * Creation is the Create Game button this component hands to `ResourceExplorer` as
 * `homeBarRight`, which publishes it into the home bar. The button navigates to the reserved
 * `/new` segment — hence `creating` here rather than a `newLabel` on the rail — because
 * `homeBarRight` and `newLabel` are two different creation mechanisms: this feature creates by
 * navigating and opens its OWN `CreateResourceDialog` off that URL, while `newLabel` instead
 * drives `ResourceExplorer`'s internal `newOpen` state — and this feature supplies no
 * `renderDialog` for that state to render, so a `newLabel` here would ship a button that opens
 * nothing.
 */
export function GamesFeature({
  basePath,
  workspaceSlug: slug,
  all,
  creating,
  activeGameId,
  activeTopic,
  activeLeafId,
  activeMemberEntityId,
}: {
  /** The feature's URL base (drives routes + the list cache key); the host passes `/<slug>`. */
  basePath: string;
  /** The workspace slug whose primary ecosystem scopes the catalog. Supplied by the host
   *  rather than read from useParams here, so a host without workspace context fails
   *  visibly at the prop seam instead of silently deriving undefined. */
  workspaceSlug?: string;
  all?: boolean;
  creating?: boolean;
  activeGameId?: string;
  activeTopic?: string;
  activeLeafId?: string;
  activeMemberEntityId?: string;
}): ReactElement {
  const router = useRouter();

  // Slug -> ecosystem id, the same cached lookup the sibling Teams and Ecosystems features do.
  const {
    item: resolvedEcosystemId,
    isSettled: lookupSettled,
    error: lookupError,
  } = useResourceItemQuery<string | null>(
    "workspace:default-ecosystem-id",
    slug ?? null,
    ecosystemsApi.ecosystemIdForSlug,
  );
  const ecosystemId = resolvedEcosystemId ?? undefined;
  // Terminal non-success states get DEFINED surfaces, never an eternal unlabeled spinner
  // (which reads as an outage): "failed" = the lookup errored, "none" = the workspace has no
  // primary ecosystem yet. No slug is "pending", because nothing has been asked.
  const lookup: "pending" | "resolved" | "failed" | "none" = lookupError
    ? "failed"
    : slug == null || !lookupSettled
      ? "pending"
      : resolvedEcosystemId != null
        ? "resolved"
        : "none";

  const load = useCallback(
    () =>
      ecosystemId
        ? gamesApi.list(ecosystemId)
        : slug != null && lookup === "pending"
          ? new Promise<Game[]>(() => {}) // slug resolving: leave items null (Loading…)
          : Promise.resolve<Game[]>([]), // unscoped / failed / no-ecosystem: a defined empty state
    [ecosystemId, slug, lookup],
  );
  const { items: games, reload, error } = useResourceList<Game>(basePath, load);

  const canCreate = slug != null && lookup !== "failed" && lookup !== "none";

  const topics: ResourceTopic[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <FileText size={16} aria-hidden />,
      description: "What this game is called and what it is about.",
      render: (gameId, titleFor) => (
        <GameOverviewPane
          gameId={gameId}
          items={games}
          refresh={reload}
          loadError={error}
          title={titleFor("Overview")}
        />
      ),
    },
    {
      id: "engine",
      label: "Engine",
      icon: <Cpu size={16} aria-hidden />,
      description: "The runtime this game is built for, and its configuration.",
      dividerAfter: true,
      render: (gameId, titleFor) => (
        <GameEnginePane
          gameId={gameId}
          items={games}
          refresh={reload}
          loadError={error}
          title={titleFor("Engine")}
        />
      ),
    },
    {
      id: "content",
      label: "Content",
      icon: <Boxes size={16} aria-hidden />,
      description: "The things this game is made of — rooms, spells, items.",
      // Publishes a deeper rail, so choosing it is an INTERMEDIATE select and the detail holds.
      leadsTo: "list",
      // The only topic that takes `subLeafFor`: an open definition shows its own effects and
      // connections, and those get the FIFTH segment — `…/content/<defId>/<childId>` — so one of
      // them is deep-linkable and selecting one pushes the route. `parseGamesPath` has always
      // returned that segment; this is what consumes it.
      render: (gameId, titleFor, leaf, subLeafFor) => (
        <GameContentPane
          gameId={gameId}
          leaf={leaf}
          subLeafFor={subLeafFor}
          title={titleFor("Content")}
        />
      ),
    },
    {
      id: "connections",
      label: "Connections",
      icon: <Waypoints size={16} aria-hidden />,
      description: "How those things relate to one another.",
      leadsTo: "list",
      render: (gameId, titleFor, leaf) => (
        <GameConnectionsPane gameId={gameId} leaf={leaf} title={titleFor("Connections")} />
      ),
    },
    {
      id: "effects",
      label: "Effects",
      icon: <Zap size={16} aria-hidden />,
      description: "What happens, and what fires it.",
      leadsTo: "list",
      render: (gameId, titleFor, leaf) => (
        <GameEffectsPane gameId={gameId} leaf={leaf} title={titleFor("Effects")} />
      ),
    },
  ];

  return (
    <>
      <ResourceExplorer
        all={all}
        activeId={activeGameId}
        activeTopic={activeTopic}
        activeLeafId={activeLeafId}
        activeMemberEntityId={activeMemberEntityId}
        basePath={basePath}
        items={games}
        getId={(g) => g.id}
        getLabel={(g) => g.name}
        nameSuffix="Game"
        itemIcon={<Gamepad2 size={16} aria-hidden />}
        topics={topics}
        reload={reload}
        // Create Game, in the home bar: handed to `ResourceExplorer` as `homeBarRight` rather
        // than as a `newLabel`, because the two are different creation mechanisms. This feature
        // creates by NAVIGATING to the reserved `/new` segment (see `creating` below) and opens
        // its OWN `CreateResourceDialog` off that URL; a `newLabel` button instead flips
        // `ResourceExplorer`'s internal `newOpen`, and this feature supplies no `renderDialog`
        // for that state to render — so a `newLabel` here would ship a button that opens
        // nothing. (Passing both anyway would not stack two controls: `resource-explorer.tsx`'s
        // `right` assignment makes `homeBarRight` win the slot outright over `newLabel`'s
        // button.)
        homeBarRight={<CreateGameAction basePath={basePath} />}
        rail={{
          title: "All games",
          help: "Pick a game to edit what it is, how it runs, and what it contains.",
          getSublabel: (g) => g.slug,
          // A failed list leaves `items` null forever, which is indistinguishable from loading
          // from the rail's side — without this it claims to be loading for good.
          loadError: error,
          emptyLabel:
            slug == null
              ? "Games aren't available on this site yet — open them from your hub workspace."
              : lookup === "failed"
                ? "Couldn't load this workspace — reload the page to retry."
                : lookup === "none"
                  ? "This workspace has no ecosystem to hold games yet."
                  : "No games yet — use Create Game above.",
        }}
      />

      {/* Create Game always links to `/new` — it does not consult `canCreate` before navigating,
          and `/new` is a URL like any other: reachable by a bookmark, a typed address, or a
          refresh, not only this button's click. Say so rather than rendering nothing: without
          this a visit changed the URL and produced no visible response at all. Acknowledging
          returns to the workspace root, the same place Cancel goes. */}
      {creating && !canCreate && (
        <AlertModal
          open
          tone="error"
          title="Can’t create a game here"
          description={
            slug == null
              ? "This site has no workspace selected — open games from your hub workspace."
              : lookup === "failed"
                ? "This workspace couldn’t be loaded, so there is nowhere to put a new game yet. Reload the page and try again."
                : "This workspace has no ecosystem to hold games yet. Create one first, then come back."
          }
          confirmLabel="Close"
          onConfirm={() => router.push(basePath)}
        />
      )}

      {/* The URL is the dialog's only trigger: `/<workspace>/new`, pushed by Create Game in the
          home bar. Closing returns to the workspace root; creating routes to the new game. */}
      {creating && canCreate && (
        <CreateResourceDialog
          ariaLabel="New game"
          heading="New game"
          blank={gameBlank}
          validate={(d) => gameValidate(gameNormalize(d), (games ?? []).map((g) => g.slug))}
          create={(d) => {
            // Guarded for safety: `canCreate` already gates this dialog, so it covers only the
            // narrow window before the ecosystem lookup settles. `clientRefusal` and not a bare
            // Error: the dialog reports whatever it catches, and a status-less error files this
            // half-second race in production telemetry as a backend outage.
            if (!ecosystemId)
              return Promise.reject(
                clientRefusal("The workspace hasn't finished loading — try again."),
              );
            return gamesApi.create(gameNormalize(d), ecosystemId);
          }}
          onClose={() => router.push(basePath)}
          // NOT async. `onCreated` is typed `(result) => void` and CreateResourceDialog does
          // not await it — it calls it inside its own try, so a promise returned here is never
          // awaited and a rejected re-read becomes an unhandled rejection while the dialog sits
          // on "Saving…" forever. So the re-read is fired and forgiven (the list's own error
          // banner shows it), and the navigation does not wait on it: the game exists, so its
          // URL is right either way, and this feature stays mounted across the push.
          onCreated={(game) => {
            void reload().catch(() => {});
            router.push(`${basePath}/${encodeURIComponent(game.id)}`);
          }}
          renderForm={(draft, onChange, formError) => (
            <GameIdentityFields draft={draft} onChange={onChange} error={formError} />
          )}
        />
      )}
    </>
  );
}
