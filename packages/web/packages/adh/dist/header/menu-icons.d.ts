import { type LucideIcon } from 'lucide-react';
/** entry key → icon. See the module comment for the key scheme. */
export declare const MENU_ICONS: Record<string, LucideIcon>;
/** Resolve a menu row's icon by its entry key, or undefined if none is mapped
 *  (the renderer leaves the icon slot empty rather than guessing). */
export declare function menuIcon(key: string | undefined): LucideIcon | undefined;
//# sourceMappingURL=menu-icons.d.ts.map