"use client"

import { createContext, useContext, type ComponentProps, type ReactNode } from "react"

import { HierarchicalTopicDetail } from "./hierarchical-topic-detail"
import { HierarchicalMenuDetail } from "./hierarchical-menu-detail"

/**
 * WHICH hierarchical view the app renders — the one switch behind every stack on the platform.
 *
 * The two components answer the same question (a flat `levels` array + a leaf detail) with two
 * different disclosures, and the experiment is deciding between them. Rather than settle it call
 * site by call site, every consumer renders {@link HierarchicalDetailView} and the choice is made
 * ONCE, here, from whatever the host app puts in this context.
 *
 * It is a context and not a prop because most of the stacks are not the app's to pass a prop to:
 * ResourceExplorer, CrudDataBrowser, ApiBrowser and the persona sections each render their own
 * stack several layers below any app code, and threading a boolean through all of them would put
 * the decision back at the call sites this exists to spare.
 *
 * Default FALSE (the classic HTDV): an app that mounts no provider — the builds/status boards, the
 * showcase, a test — keeps rendering exactly what it renders today, and the menu view is reached
 * only by deliberately asking for it. The toolkit stays flag-agnostic; the adh apps wire this to
 * their `use_hierarchical_menu_details_view` feature flag.
 */
const MenuDetailViewContext = createContext(false)

export function HierarchicalDetailViewProvider({
  menuDetail,
  children,
}: {
  /** True ⇒ every {@link HierarchicalDetailView} below renders the cascading menu stack (HMDV);
   *  false ⇒ the classic topic stack (HTDV). */
  menuDetail: boolean
  children: ReactNode
}) {
  return <MenuDetailViewContext.Provider value={menuDetail}>{children}</MenuDetailViewContext.Provider>
}

/** The current choice — true when the menu (cascading) view is the one in force. For a consumer
 *  that must vary something ELSE alongside the switch; rendering the right stack needs only
 *  {@link HierarchicalDetailView}. */
export function useHierarchicalMenuDetailView(): boolean {
  return useContext(MenuDetailViewContext)
}

/** HMDV's props are a SUPERSET of HTDV's — HTDV's set plus the cascade-only members HMDV adds
 *  (`disclosureStyle: "cascading"` and `autoHideTopics`) — so the wider of the two IS the switch's
 *  surface and nothing here restates them: the props stay documented once, on the components, and
 *  cannot drift out of step with a third copy. The two cascade-only props are meaningful only under
 *  HMDV; the HTDV branch below reconciles `disclosureStyle` and drops `autoHideTopics` (HTDV has no
 *  auto-hide mode), so a consumer passing one gets HMDV's behaviour when the cascade view is on and
 *  no effect under the classic view. */
export type HierarchicalDetailViewProps = ComponentProps<typeof HierarchicalMenuDetail>

/**
 * The hierarchical topic/detail stack, in whichever view the host app has chosen — see
 * {@link HierarchicalDetailViewProvider}. Every consumer should render THIS rather than reaching
 * for either component directly; the two behind it are an implementation detail of the experiment,
 * and when it concludes this file and the losing component go away together.
 */
export function HierarchicalDetailView(props: HierarchicalDetailViewProps) {
  const menuDetail = useHierarchicalMenuDetailView()
  if (menuDetail) return <HierarchicalMenuDetail {...props} />

  const { disclosureStyle, ...rest } = props
  // The vertical cascade is HMDV's own disclosure and HTDV has no such style, so a consumer that
  // asks for it has to mean SOMETHING under the classic view. `covered` is that something: the
  // cascade already borrows covered's rules for its covering, pins and hover reveal, so it is the
  // same stack minus the vertical step — and it degrades rather than throwing a bad prop at HTDV.
  // `autoHideTopics` (HMDV's other cascade-only prop) rides along in `...rest`; HTDV has no auto-hide
  // mode and simply ignores it — an unknown prop, not an error.
  return (
    <HierarchicalTopicDetail
      {...rest}
      disclosureStyle={disclosureStyle === "cascading" ? "covered" : disclosureStyle}
    />
  )
}
