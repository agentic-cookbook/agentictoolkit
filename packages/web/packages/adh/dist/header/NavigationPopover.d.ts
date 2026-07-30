import { type ReactElement, type ReactNode } from 'react';
import { type NavLinkIcon } from './NavLink';
/** An icon component for a menu row.
 *
 *  Deliberately NOT lucide's `LucideIcon`. Every caller that fills this in lives in
 *  another package with its OWN lucide-react + @types/react copy (a consumer's icon
 *  map is normally in its own pnpm tree, not this one), and `LucideIcon` is a
 *  `ForwardRefExoticComponent` whose `ref` bottoms out in @types/react's nominal
 *  `UNDEFINED_VOID_ONLY` symbol — so a foreign lucide icon fails to assign with
 *  "Two different types with this name exist, but they are unrelated." Same problem
 *  and same remedy as {@link NavLinkIcon}, which this is an alias of: accept any
 *  className-bearing component. */
export type PopoverIcon = NavLinkIcon;
/** One destination row. `href` makes the row a real link (middle-click /
 *  open-in-new-tab work); omit it for an informational, non-navigable row (e.g.
 *  a dynamic-segment pattern that has no single destination). `key` is a stable
 *  per-instance id; `current` flags the user's current location (aria-current);
 *  `description` is an optional tagline; `icon` is an optional leading glyph.
 *  `onSelect` makes the row an action rather than a destination — it runs INSTEAD
 *  of navigation (no `href` needed) and takes priority over the popover's
 *  `onChoose`, so a single popover can mix links with commands (e.g. "Debug
 *  Options" opening a floating window). */
export type PopoverItem = {
    key: string;
    label: string;
    description?: string;
    href?: string;
    current?: boolean;
    /** Optional leading icon, rendered in a fixed-width slot before the label. */
    icon?: PopoverIcon;
    onSelect?: () => void;
};
/** A top-level entry: either a leaf row, or a topic that opens a flyout submenu.
 *  `section` groups entries for dividers — a divider falls between sections,
 *  never within one. `blurb` shows a leaf's description inline. `indent` renders
 *  the row as an always-visible inline sub-item (indented under the row above it);
 *  a topic's `icon` is its own leading glyph. */
export type PopoverEntry = {
    kind: 'leaf';
    section: number;
    item: PopoverItem;
    blurb?: boolean;
    indent?: boolean;
} | {
    kind: 'topic';
    section: number;
    label: string;
    items: PopoverItem[];
    icon?: PopoverIcon;
    indent?: boolean;
};
/** Imperative handle handed to slot render-props so they can close the menu —
 *  optionally WITHOUT restoring focus to the trigger, when they're handing focus
 *  off to another surface (a dialog/popover) that owns Escape-to-dismiss. */
export type PopoverClose = (opts?: {
    restoreFocus?: boolean;
}) => void;
/** An optional special command surfaced while searching (e.g. "help"). When
 *  `matches(query)` is true the list shows a single command row instead of search
 *  results; selecting it closes the menu (focus not restored) then runs `onSelect`. */
export type PopoverSearchCommand = {
    matches: (query: string) => boolean;
    label: ReactNode;
    shortcut?: ReactNode;
    onSelect: () => void;
};
export type NavigationPopoverProps = {
    /** The ordered top-level entries (resolved: hrefs + current flags applied). */
    entries: PopoverEntry[];
    /** Accessible label for the trigger button (e.g. "Storage — switch site"). */
    triggerLabel: string;
    /** Replaces the trigger's default "{label} ⌄" content. */
    triggerContent?: ReactNode;
    /** Short text shown inside the default trigger before the chevron. */
    triggerText?: string;
    /** Optional icon rendered before the default trigger's text (ignored when
     *  `triggerContent` replaces the default). SiteMenu passes the brand mark. */
    triggerIcon?: ReactNode;
    /** Extra class on the trigger button. */
    triggerClassName?: string;
    /** Command-field placeholder + its accessible name. */
    placeholder?: string;
    /** Empty-state line when a search matches nothing. */
    emptyLabel?: string;
    /** Invoked to navigate to a chosen item. Defaults to a full-page assign to the
     *  item's href — subclasses override for SPA navigation. */
    onChoose?: (item: PopoverItem) => void;
    /** Trailing control in the command row (e.g. a help "?" or settings gear).
     *  Receives `close` so it can dismiss the menu before handing focus off. */
    commandTrailing?: (api: {
        close: PopoverClose;
    }) => ReactNode;
    /** Optional special search command (see {@link PopoverSearchCommand}). */
    searchCommand?: PopoverSearchCommand;
};
/**
 * A header command menu: a trigger that opens a popover whose top level mixes
 * promoted leaf links and TOPICS — each a cascading submenu that pops out to the
 * side. Nothing is disclosed or selected until the user acts: hover a topic, or
 * press ↓ to start. Focus stays in the command field, which drives the highlight
 * in a two-level model: ↑/↓ move the highlight (walking the top-level entries,
 * or — once inside an open submenu — that submenu's items, then SPILLING into the
 * adjacent topic's submenu at the edges); → opens the highlighted topic and steps
 * into it; ← closes it again (→ reopens). Enter navigates the highlight (or opens
 * a closed topic). Typing switches to a flat autocomplete across EVERY item
 * (case-insensitive substring, matched chars underlined), each result shown as
 * "{area} → {item}".
 *
 * This is the reusable base behind {@link SiteSwitcher} (family sites) and the
 * SiteMenu's Routes flyout (a site's own routes, see routeEntries.ts). Subclasses
 * supply the resolved {@link PopoverEntry} structure, the trigger content, how to
 * navigate a chosen item, and any command-row trailing control / special search
 * command.
 */
export declare function NavigationPopover({ entries, triggerLabel, triggerContent, triggerText, triggerIcon, triggerClassName, placeholder, emptyLabel, onChoose, commandTrailing, searchCommand, }: NavigationPopoverProps): ReactElement;
//# sourceMappingURL=NavigationPopover.d.ts.map