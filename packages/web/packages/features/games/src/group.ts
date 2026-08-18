/**
 * Order a flat list so its groups read as groups.
 *
 * The three list topics here want grouping — definitions and mappings by `kind`, effects
 * by `trigger` — but `TopicLevel.items` is a flat `TopicDetailItem[]` with no group-header
 * vocabulary, and drawing a second grouped list beside the rail is exactly the duplicated
 * surface docs/ui/fleet-ui-audit.md §1.5 removed. So grouping is expressed in the ordering:
 * same-group rows are adjacent, and each row's `sublabel` names its group. Nothing shared
 * has to change, and the rail keeps behaving like every other rail in the fleet.
 *
 * `localeCompare` throughout, so `alpha` sorts before `Zap` rather than after it by byte
 * value. Returns a new array.
 *
 * `getSort` is the EXPLICIT ordering all three child tables carry (`sort_order`), and it
 * outranks the label inside a group. It matters most for effects, where the schema says
 * order is load-bearing — `add` then `multiply` is not `multiply` then `add` — so a list
 * sorted by name would show an order the engine does not run. The label still breaks ties,
 * because `sort_order` defaults to 0 and a whole group sharing it must not be arbitrary.
 */
export function sortByGroup<T>(
  items: T[],
  getGroup: (item: T) => string,
  getLabel: (item: T) => string,
  getSort?: (item: T) => number,
): T[] {
  return [...items].sort((a, b) => {
    const byGroup = getGroup(a).localeCompare(getGroup(b), undefined, { sensitivity: "base" });
    if (byGroup !== 0) return byGroup;
    if (getSort) {
      const bySort = getSort(a) - getSort(b);
      if (bySort !== 0) return bySort;
    }
    return getLabel(a).localeCompare(getLabel(b), undefined, { sensitivity: "base" });
  });
}
