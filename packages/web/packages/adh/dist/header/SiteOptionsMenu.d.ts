export type SiteLink = {
    label: string;
    href: string;
    description?: string;
};
export type SiteOptionsMenuProps = {
    sites: SiteLink[];
    triggerLabel?: string;
    groupLabel?: string;
};
export declare function SiteOptionsMenu({ sites, triggerLabel, groupLabel, }: SiteOptionsMenuProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=SiteOptionsMenu.d.ts.map