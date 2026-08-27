/** The one breakpoint at which `.adh-header__links` goes `display: none`
 *  (`adh-components.css`). Kept beside the rule it mirrors, and asserted against it by
 *  `useHeaderLinksCollapsed.test.ts` — two copies of a breakpoint that drift apart give
 *  a phone either no nav at all or two of it. */
export declare const HEADER_LINKS_COLLAPSE_QUERY = "(max-width: 768px)";
/**
 * True when the header bar has dropped its primary nav links — i.e. on a phone.
 *
 * The bar cannot hold the brand, three-plus destinations and the auth cluster inside
 * 390px, so `.adh-header__links` is hidden below 768px. That is a real constraint, not
 * a preference; what was missing is the other half — somewhere for those destinations
 * to go. This hook is what lets the site menu pick them up exactly while the bar has
 * put them down.
 *
 * A JS gate rather than a CSS one, deliberately. Hiding the rows with `display: none`
 * would leave them focusable in the tab order and matchable by the popover's own search
 * box, so a desktop user could type "contact" and land on a row nothing on screen
 * showed. The rows must not EXIST above the breakpoint, and only JS can say that.
 *
 * The server snapshot is `false` — no viewport exists there, and a phone briefly
 * rendering desktop rows would be worse than the reverse. Safe because the popover's
 * contents never appear in server HTML at all: they mount when the menu opens, which
 * is necessarily after hydration.
 */
export declare function useHeaderLinksCollapsed(): boolean;
//# sourceMappingURL=useHeaderLinksCollapsed.d.ts.map