/**
 * The Help modal — a backdrop-less, draggable {@link FloatingWindow} (the same shell as the debug
 * console) whose {@link HierarchicalDetailView} navigates {@link buildTopicLevels}. It shares the
 * exact topic tree + level builder with the SSR help site (the standalone site is the same HMDV,
 * server-rendered), so the modal and the site stay in lockstep. Fully controlled: the caller
 * ({@link HelpProvider}) owns `open` and the selection `path` (the chosen topic id at each depth),
 * so deep-links and Back-navigation share one source of truth.
 */
export declare function HelpWindow({ open, onClose, path, onPathChange, }: {
    open: boolean;
    onClose: () => void;
    path: string[];
    onPathChange: (path: string[]) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=HelpWindow.d.ts.map