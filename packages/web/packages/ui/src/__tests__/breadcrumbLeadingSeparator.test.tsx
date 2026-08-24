import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HierarchicalTopicDetail, type TopicLevel } from "../blocks/hierarchical-topic-detail";
import { HierarchicalMenuDetail } from "../blocks/hierarchical-menu-detail";

// A one-crumb trail is the case this change exists for: with the separator drawn only BETWEEN
// crumbs, a lone root label read as a heading rather than as the head of a trail.
//
// Two plain `describe` blocks calling one shared helper, rather than a `describe.each` over both
// components — `HierarchicalTopicDetail` and `HierarchicalMenuDetail` are two distinct function
// types, and typing a `describe.each` callback parameter as their union produces a "no overload
// matches this call" error at the render call. `tsc` doesn't run on this branch, so this file
// avoids a form that might not compile.
//
// The level's own `title` is deliberately NOT "All projects" — the rail paints its title as
// visible text of its own (`blocks/topic-detail.tsx:753`), outside the `<nav>`, so giving it the
// same text as `rootLabel` would make the crumb text ambiguous with the rail's title text on the
// page. `rootLabel` is what supplies "All projects" to the breadcrumb trail.
// `onSelect`/`onClear` are no-ops: this suite never drives a selection, only asserts the
// breadcrumb's static leading-separator markup, so the rail's navigation callbacks are unused.
const ONE_CRUMB_LEVELS: TopicLevel[] = [
  { id: "l", title: "Projects", items: [], selectedId: null, onSelect: () => {}, onClear: () => {} },
];

function expectLeadingChevron(ui: ReactElement) {
  render(ui);
  const nav = screen.getByLabelText("Breadcrumb");
  expect(nav.querySelectorAll("svg")).toHaveLength(1);
  expect(within(nav).getByText("All projects")).toBeInTheDocument();
}

function expectSeparatorsAriaHidden(ui: ReactElement) {
  render(ui);
  const nav = screen.getByLabelText("Breadcrumb");
  const separators = nav.querySelectorAll("svg");
  expect(separators.length).toBeGreaterThan(0);
  separators.forEach((el) => {
    expect(el).toHaveAttribute("aria-hidden");
  });
}

describe("HierarchicalTopicDetail breadcrumb", () => {
  it("draws a separator before the root crumb of a one-crumb trail", () => {
    expectLeadingChevron(
      <HierarchicalTopicDetail levels={ONE_CRUMB_LEVELS} rootLabel="All projects">
        {null}
      </HierarchicalTopicDetail>,
    );
  });

  it("keeps the separators aria-hidden so the trail reads unchanged", () => {
    expectSeparatorsAriaHidden(
      <HierarchicalTopicDetail levels={ONE_CRUMB_LEVELS} rootLabel="All projects">
        {null}
      </HierarchicalTopicDetail>,
    );
  });
});

describe("HierarchicalMenuDetail breadcrumb", () => {
  it("draws a separator before the root crumb of a one-crumb trail", () => {
    expectLeadingChevron(
      <HierarchicalMenuDetail levels={ONE_CRUMB_LEVELS} rootLabel="All projects">
        {null}
      </HierarchicalMenuDetail>,
    );
  });

  it("keeps the separators aria-hidden so the trail reads unchanged", () => {
    expectSeparatorsAriaHidden(
      <HierarchicalMenuDetail levels={ONE_CRUMB_LEVELS} rootLabel="All projects">
        {null}
      </HierarchicalMenuDetail>,
    );
  });
});
