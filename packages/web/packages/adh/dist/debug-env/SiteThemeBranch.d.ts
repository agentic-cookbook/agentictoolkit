import type { TopicLevel } from '@agentic-toolkit/ui/blocks';
import type { ThemeEditorApi } from '@agentic-toolkit/adh/themes';
import type { ThemeAreasSurface } from './seams';
export declare function useSiteThemeBranch(ed: ThemeEditorApi, themeAreas: ThemeAreasSurface): {
    levels: TopicLevel[];
    leaf: import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
    requestFocus: (key: string | null) => void;
    guardLeave: (run: () => void) => void;
    prompt: import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
};
//# sourceMappingURL=SiteThemeBranch.d.ts.map