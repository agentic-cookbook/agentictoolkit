export type SiteLink = {
    /** OPTIONAL stable identity for the target, independent of its URL. `SiteSwitcher`
     *  hands it back to `onSwitchSite` so a caller can rewrite the destination without
     *  parsing the href; absent, the href plays that role. Optional deliberately: this
     *  type is owned by `SiteOptionsMenu`, which never reads the field, and making it
     *  required would break every existing caller of a published type on behalf of a
     *  different component. */
    id?: string;
    label: string;
    href: string;
    description?: string;
};
export type SiteOptionsMenuProps = {
    sites: SiteLink[];
    triggerLabel?: string;
    /** Heading over the list. Defaults to a generic label: this package publishes no
     *  site family of its own, so a consumer's product name has to come from the
     *  consumer. */
    groupLabel?: string;
};
export declare function SiteOptionsMenu({ sites, triggerLabel, groupLabel, }: SiteOptionsMenuProps): import("react").JSX.Element | null;
//# sourceMappingURL=SiteOptionsMenu.d.ts.map