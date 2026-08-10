import { describe, it, expect } from "vitest";
import { PRODUCT_TOPICS, HOST_RENDERED_TOPIC_IDS } from "../topics";
import { PRODUCT_TOPIC_CONFIGS } from "../ProductsFeature";

// Two invariants that hold the rail together and that nothing else can see: a topic renders a
// BLANK cell when its icon is missing, and a BLANK PANE when no one claims it. Both are legal
// React, so neither tsc nor a screenshot of the topics that DO work says a word.

describe("the product topic rail", () => {
  it("gives every topic an icon", () => {
    const iconless = PRODUCT_TOPIC_CONFIGS.filter((t) => !t.icon).map((t) => t.id);
    expect(iconless).toEqual([]);
  });

  it("carries every topic through to the rail config, in order", () => {
    expect(PRODUCT_TOPIC_CONFIGS.map((t) => t.id)).toEqual(PRODUCT_TOPICS.map((t) => t.id));
    expect(PRODUCT_TOPIC_CONFIGS.map((t) => t.label)).toEqual(PRODUCT_TOPICS.map((t) => t.label));
  });

  it("keeps every dividerAfter, which is what groups the rail visually", () => {
    expect(PRODUCT_TOPIC_CONFIGS.map((t) => t.dividerAfter)).toEqual(
      PRODUCT_TOPICS.map((t) => t.dividerAfter),
    );
  });
});

describe("the host-rendered seam", () => {
  // A POSITIVE assertion about the SETTLED list, not a spot-check of four names: every id a host
  // is told to expect is either a real topic or the Storage group's All Data member. An id that
  // is neither would be a seam contract for a pane that can never be asked for.
  it("names only real topics (plus the one group member that is not one)", () => {
    const topicIds = new Set<string>(PRODUCT_TOPICS.map((t) => t.id));
    const notATopic = HOST_RENDERED_TOPIC_IDS.filter((id) => !topicIds.has(id));
    expect(notATopic).toEqual(["all-data"]);
  });

  // The other direction, and the one that actually fails on a change: EVERY topic on the rail has
  // to be somebody's. Adding one to PRODUCT_TOPICS without a pane means a row that opens on
  // nothing — legal React, invisible to tsc, and invisible to a screenshot of the rest.
  it("leaves no topic unowned", () => {
    // Claimed by this package's own topic-pane switch (ProductsFeature's renderProductTopicPane).
    const PACKAGE_PANES = [
      "project", "integrations", "messaging", "tokens", "applications",
      "signin-apps", "gamification", "auth", "feature-flags", "server-bags",
    ];
    // Rendered by EcosystemsFeature itself, asked of NEITHER seam: the two GROUP topics, whose
    // nested sub-rails it owns (their members come back through the seams — Buckets/Access/Users
    // to the switch above, All Data to the host), and the product's own entity pane.
    const FEATURE_OWNED = ["storage", "invitations", "settings"];
    const owned = new Set<string>([...PACKAGE_PANES, ...FEATURE_OWNED, ...HOST_RENDERED_TOPIC_IDS]);
    const unowned = PRODUCT_TOPICS.map((t) => t.id).filter((id) => !owned.has(id));
    expect(unowned).toEqual([]);
  });
});
