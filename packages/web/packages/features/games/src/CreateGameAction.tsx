"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@agentic-toolkit/ui/components/button";

/**
 * The home bar's right-justified Create Game control. `GamesFeature` renders it and hands it to
 * `ResourceExplorer` as `homeBarRight`, which publishes it into the bar.
 *
 * It NAVIGATES rather than opening GamesFeature's own create dialog (`CreateResourceDialog`)
 * directly: `creating` is `GamesFeature`'s `creating` PROP, derived upstream from the URL by
 * `parseGamesPath` — not component state this button could set, even though it ends up in the
 * same React tree as the dialog. So the button pushes `<basePath>/new`, the reserved first
 * segment `parseGamesPath` understands, and `GamesFeature` opens its dialog once it reads
 * `creating` off the parsed URL. A URL like any other: reachable by a bookmark, a typed
 * address, or a refresh, not only this button's click.
 *
 * A <Link>, not an onClick push: it is a navigation, so it should be middle-clickable and
 * copyable like one.
 */
export function CreateGameAction({ basePath }: { basePath: string }) {
  const href = `${basePath.replace(/\/+$/, "")}/new`;
  return (
    <Link href={href} className={buttonVariants({ size: "sm", variant: "outline" })}>
      <Plus data-icon="inline-start" />
      Create Game
    </Link>
  );
}
