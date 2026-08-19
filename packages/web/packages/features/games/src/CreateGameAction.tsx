"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@agentic-toolkit/ui/components/button";

/**
 * The home bar's right-justified Create Game control, published by `GamesFeature` via
 * `HomeBarPortal`.
 *
 * It NAVIGATES rather than opening a dialog by state. `ResourceExplorer`'s create dialog opens
 * only from its own internal `useState` — there is no external signal to send it. So the button
 * pushes `<basePath>/new`, the reserved first segment `parseGamesPath` understands, and the
 * feature opens the dialog from the parsed URL. Deep-linkable and refresh-surviving, which is
 * how the rest of the fleet addresses state anyway.
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
