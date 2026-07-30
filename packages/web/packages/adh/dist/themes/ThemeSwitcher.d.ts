import { type AdhThemeKey } from './adh-themes';
export type ThemeSwitcherProps = {
    current?: AdhThemeKey;
    label?: string;
    onThemeChange?: (key: AdhThemeKey) => void;
};
export declare function ThemeSwitcher({ current, label, onThemeChange, }: ThemeSwitcherProps): import("react").JSX.Element;
//# sourceMappingURL=ThemeSwitcher.d.ts.map