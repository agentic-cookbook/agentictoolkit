/// <reference types="@testing-library/jest-dom/vitest" />
//
// ResourceExplorer warms the ROUTE a row would open. `TopicRail` supplies the intent signal (a
// ~100ms hover/focus dwell) but owns no router, so without this wiring the whole prefetch path is
// inert: every prop typechecks, every unit test of the signal passes, and not one request is ever
// warmed. That is precisely the failure this file exists to catch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { ResourceExplorer, type ResourceTopic } from "../resource-explorer";

const prefetch = vi.fn();
const push = vi.fn();
// The doubles forward EVERY argument. A `(href) => push(href)` shim would silently swallow the
// options object `select` passes, and the drift assertion below is precisely about what reaches
// the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => push(...args),
    replace: vi.fn(),
    prefetch: (...args: unknown[]) => prefetch(...args),
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  prefetch.mockClear();
  push.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

interface Row {
  id: string;
  name: string;
}
const ITEMS: Row[] = [
  { id: "p1", name: "Project One" },
  { id: "p2", name: "Project Two" },
];
const TOPICS: ResourceTopic[] = [
  { id: "edit", label: "Edit Topic", icon: null, render: () => <div>editor pane</div> },
];

function renderExplorer(activeId?: string) {
  return render(
    <ResourceExplorer<Row>
      activeId={activeId}
      basePath="/home"
      items={ITEMS}
      getId={(i) => i.id}
      getLabel={(i) => i.name}
      nameSuffix="Project"
      topics={TOPICS}
      newLabel="New"
      landing={{
        title: "All",
        help: "help",
        emptyLabel: "none",
        getSublabel: () => "",
        renderMeta: () => null,
      }}
    />,
  );
}

describe("ResourceExplorer route prefetch", () => {
  it("warms the entity route the row would open, after the dwell", () => {
    renderExplorer();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Project One" }));
    expect(prefetch).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(100));
    expect(prefetch).toHaveBeenCalledWith("/home/p1");
  });

  // The href warmed and the href pushed must be the same string. A prefetch of a URL the click
  // never visits is worse than none: it costs a request AND leaves the click cold, while looking
  // like working code from every angle except a network trace.
  it("warms exactly the href the click pushes", () => {
    renderExplorer();

    const row = screen.getByRole("button", { name: "Project Two" });
    fireEvent.pointerEnter(row);
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.click(row);

    expect(prefetch).toHaveBeenCalledWith("/home/p2");
    expect(push).toHaveBeenCalledWith("/home/p2", { scroll: false });
  });

  // The topics list is the second level, and its rows carry the scoped id — a topic href that
  // dropped it would warm the entity route over and over instead of the topic the user is aiming at.
  it("warms the scoped topic route from the topics list", () => {
    renderExplorer("p1");

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Edit Topic" }));
    act(() => void vi.advanceTimersByTime(100));

    expect(prefetch).toHaveBeenCalledWith("/home/p1/edit");
  });

  // Sweeping past a row is not intent — see TopicList's dwell.
  it("warms nothing for a row the pointer only passes over", () => {
    renderExplorer();

    const row = screen.getByRole("button", { name: "Project One" });
    fireEvent.pointerEnter(row);
    act(() => void vi.advanceTimersByTime(40));
    fireEvent.pointerLeave(row);
    act(() => void vi.advanceTimersByTime(200));

    expect(prefetch).not.toHaveBeenCalled();
  });
});
