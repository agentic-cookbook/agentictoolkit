/// <reference types="@testing-library/jest-dom/vitest" />
//
// StandaloneRailHost is the line-for-line mirror of the hub's WorkspaceChromeProvider (same guards
// map, same registerExitGuard, same composite guard), so it owes its feature sites the same
// BROWSER-level exit guard the hub mounts: reload / tab close / in-app link click / Back must
// prompt while some pane is dirty. HTDV's `exitGuard` only covers IN-PANE exits (row switch,
// breadcrumb, re-click); without the UnsavedChangesGuard mount a feature site's /home discards a
// dirty draft on any link click with no prompt at all — which is exactly the split personaregistry
// shipped (ServicesPane warned, PersonasPane did not).
//
// The link-click path is the observable one in jsdom (beforeunload/popstate are not), and it is the
// same path hub's workspaceChromeGuard.test.tsx exercises — a raw <a> is deliberate: the guard's
// capture-phase document listener intercepts real anchor clicks.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { StandaloneRailHost, RailHostBoundary } from "../standalone-rail-host";
import { useRailExitGuard } from "../rail-host";

// This package's vitest config registers no auto-cleanup, so tear each render down explicitly —
// otherwise the second test's queries see BOTH mounted trees.
afterEach(cleanup);

/** A leaf editor that publishes its unsaved-work guard the way a real pane does (dirty-gated), and
 *  renders the in-app link whose click the guard must intercept. */
function DirtyPane({ dirty }: { dirty: boolean }) {
  useRailExitGuard(dirty ? { isDirty: () => dirty } : null);
  return <a href="/elsewhere">Elsewhere</a>;
}

describe("StandaloneRailHost — browser exit guard", () => {
  it("lets a link click through when no pane is dirty", () => {
    render(
      <StandaloneRailHost>
        <DirtyPane dirty={false} />
      </StandaloneRailHost>,
    );
    fireEvent.click(screen.getByText("Elsewhere"));
    // The control for the test below: same gesture, same query, no prompt — so a guard that
    // prompted unconditionally would fail here rather than passing both.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("raises the shared Discard/Stay alert on a link click while a pane is dirty", () => {
    render(
      <StandaloneRailHost>
        <DirtyPane dirty />
      </StandaloneRailHost>,
    );
    fireEvent.click(screen.getByText("Elsewhere"));
    // The platform's one alert — asserted by its real button names, not a local literal.
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stay" })).toBeTruthy();
  });

  // personaregistry's PersonasPane is a StandaloneRailHost mount (via RailHostBoundary) sitting
  // beside GeneralPane/ServicesPane, which both pass onNavigate={(href) => router.push(href)} to
  // their own UnsavedChangesGuard — so a General/Services discard stays client-side (warm cache,
  // ?tab=/?persona=/?service= view state preserved) while a Personas discard used to hard-reload
  // the document. `onNavigate` threading through this host (and the RailHostBoundary that creates
  // it) is what closes that gap; these two tests pin the callback actually being invoked, not just
  // accepted as a prop.
  it("routes Discard through a supplied onNavigate instead of a full reload", async () => {
    const onNavigate = vi.fn();
    const realLocation = window.location;
    const { href, origin, pathname, search } = realLocation;
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href, origin, pathname, search, assign },
    });

    try {
      render(
        <StandaloneRailHost onNavigate={onNavigate}>
          <DirtyPane dirty />
        </StandaloneRailHost>,
      );
      fireEvent.click(screen.getByText("Elsewhere"));
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/elsewhere"));
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
  });

  it("falls back to window.location.assign when no onNavigate is supplied", async () => {
    const realLocation = window.location;
    const { href, origin, pathname, search } = realLocation;
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href, origin, pathname, search, assign },
    });

    try {
      render(
        <StandaloneRailHost>
          <DirtyPane dirty />
        </StandaloneRailHost>,
      );
      fireEvent.click(screen.getByText("Elsewhere"));
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      await waitFor(() => expect(assign).toHaveBeenCalledWith("/elsewhere"));
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
  });

  it("RailHostBoundary forwards onNavigate to the StandaloneRailHost it creates", async () => {
    const onNavigate = vi.fn();
    const realLocation = window.location;
    const { href, origin, pathname, search } = realLocation;
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href, origin, pathname, search, assign },
    });

    try {
      render(
        <RailHostBoundary onNavigate={onNavigate}>
          <DirtyPane dirty />
        </RailHostBoundary>,
      );
      fireEvent.click(screen.getByText("Elsewhere"));
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/elsewhere"));
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
  });
});
