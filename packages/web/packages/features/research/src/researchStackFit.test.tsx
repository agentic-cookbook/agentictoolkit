/**
 * The research editor's SHRINK SEQUENCE, at the widths a laptop and a tablet actually give it.
 *
 * A visual walk measured the edit route at 768x723 showing two FULL 240px rails and a 288px
 * detail pane — half of the 36rem (576px) floor `HierarchicalTopicDetail` promises, and the
 * direct cause of the editor's fields piling on top of each other. That measurement is what
 * this file exists to keep honest, because the fit math is not something you can read off the
 * component: it depends on the LEVEL SHAPE this feature publishes (how many rails, and whether
 * the frontier is selected — an unselected frontier claims no detail minimum, which is a legal
 * way to get exactly the bad geometry).
 *
 * So this asserts the sequence through the REAL stack — ResearchFeature → RailHostBoundary →
 * StandaloneRailHost → HierarchicalTopicDetail — rather than against a synthetic level array.
 * jsdom reports every element as 0-wide and never runs a ResizeObserver, so the container width
 * is mocked and the observers are fired by hand; every geometric value read back is one the
 * component computed and wrote as an inline style, which is the same number the browser lays
 * out with.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor, cleanup } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@agentic-toolkit/auth", () => ({
  useAuth: () => ({ user: { name: "Ada Lovelace" } }),
  reportUnexpectedAuthError: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/markdown", () => ({
  markdownApi: {
    list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(),
    categories: vi.fn(), categoryTree: vi.fn(), createCategory: vi.fn(),
    tags: vi.fn(), routeAvailable: vi.fn(), publish: vi.fn(),
  },
  taxonomyApi: {
    renameCategory: vi.fn(), categoryParents: vi.fn(), addCategoryParent: vi.fn(),
    removeCategoryParent: vi.fn(), deleteCategory: vi.fn(), renameTag: vi.fn(), deleteTag: vi.fn(),
  },
}));

import { ResearchFeature } from "./ResearchFeature";
import { markdownApi } from "@agentic-toolkit/data/markdown";

const list = vi.mocked(markdownApi.list);
const get = vi.mocked(markdownApi.get);
const categories = vi.mocked(markdownApi.categories);
const categoryTree = vi.mocked(markdownApi.categoryTree);
const tags = vi.mocked(markdownApi.tags);
const routeAvailable = vi.mocked(markdownApi.routeAvailable);

const SUMMARY = { id: "doc-1", title: "Layered Systems", category: "Architecture", tags: [], visibility: "private", publicRoute: null };
const DOCUMENT = { ...SUMMARY, content: "# Layered\n\nbody" };

/** The floor the stack promises a desktop detail pane: `MIN_DETAIL_DEFAULT`, 36rem. */
const MIN_DETAIL_PX = 576;
/** A covered rail's remaining peek (`COVERED_PEEK`), and a disclosed one (`FULL_RAIL`). */
const PEEK = 32;
const FULL_RAIL = 240;

let width = 1440;
const observers: (() => void)[] = [];
let realRO: typeof globalThis.ResizeObserver;
let realWidth: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  list.mockResolvedValue([structuredClone(SUMMARY)] as never);
  get.mockResolvedValue(structuredClone(DOCUMENT) as never);
  categories.mockResolvedValue([] as never);
  categoryTree.mockResolvedValue([
    { id: "cat-arch", name: "Architecture", slug: "architecture", parentIds: [] },
  ] as never);
  tags.mockResolvedValue([] as never);
  routeAvailable.mockResolvedValue({ available: true, reason: "ok" } as never);

  observers.length = 0;
  width = 1440;
  realRO = globalThis.ResizeObserver;
  realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  globalThis.ResizeObserver = class {
    constructor(private cb: () => void) {}
    observe() { observers.push(this.cb); }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = realRO;
  if (realWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", realWidth);
});

/** Deliver a new container width the way the browser would: resize, then let the observer run. */
async function resizeTo(next: number): Promise<void> {
  width = next;
  await act(async () => { observers.forEach((cb) => cb()); });
  await act(async () => { await Promise.resolve(); });
}

function rails(container: HTMLElement): { left: number; width: number }[] {
  return Array.from(container.querySelectorAll("[data-htd-col]")).map((el) => ({
    left: parseFloat((el as HTMLElement).style.left || "0"),
    width: parseFloat((el as HTMLElement).style.width || "0"),
  }));
}

/** The detail pane's left edge. Its RIGHT edge is pinned in CSS (`right: 0`), so at container
 *  width W the pane is exactly `W - left` wide. `null` means the stack has gone NARROW — one
 *  full-width pane at a time, where there is no separate detail section to measure. */
function detailLeft(container: HTMLElement): number | null {
  const el = container.querySelector("[data-htd-detail]") as HTMLElement | null;
  return el ? parseFloat(el.style.left || "0") : null;
}

async function openEditor(): Promise<HTMLElement> {
  const { container } = render(
    <ResearchFeature basePath="/w1/home" docBasePath="/w1/edit" docId="doc-1" />,
  );
  await waitFor(() => expect(get).toHaveBeenCalled());
  await act(async () => { observers.forEach((cb) => cb()); });
  await act(async () => { await Promise.resolve(); });
  return container;
}

describe("research edit route — the detail pane never goes below its floor", () => {
  it("discloses both rails when there is room for them AND the floor (1440)", async () => {
    const container = await openEditor();
    expect(rails(container)).toEqual([
      { left: 0, width: FULL_RAIL },
      { left: FULL_RAIL, width: FULL_RAIL },
    ]);
    const left = detailLeft(container);
    expect(left).toBe(2 * FULL_RAIL);
    expect(1440 - (left as number)).toBeGreaterThanOrEqual(MIN_DETAIL_PX);
  });

  // The measured defect: 768 with both rails still disclosed leaves the detail 288px — exactly
  // half its floor. Width pressure must cover them, leftmost-first, until the floor is clear.
  it("covers BOTH rails at 768 rather than starving the detail", async () => {
    const container = await openEditor();
    await resizeTo(768);
    expect(rails(container)).toEqual([
      { left: 0, width: PEEK },
      { left: PEEK, width: PEEK },
    ]);
    const left = detailLeft(container);
    expect(left).toBe(2 * PEEK);
    expect(768 - (left as number)).toBeGreaterThanOrEqual(MIN_DETAIL_PX);
  });

  // Below the wide floor (the detail's minimum plus one peek) there is nothing left to trade,
  // and the stack becomes a navigation controller: one full-width pane at a time.
  it("goes NARROW at 500, instead of squeezing the detail below the floor", async () => {
    const container = await openEditor();
    await resizeTo(500);
    expect(detailLeft(container)).toBeNull();
  });

  it("comes back when the window is widened again", async () => {
    const container = await openEditor();
    await resizeTo(500);
    await resizeTo(1440);
    expect(detailLeft(container)).toBe(2 * FULL_RAIL);
  });
});
