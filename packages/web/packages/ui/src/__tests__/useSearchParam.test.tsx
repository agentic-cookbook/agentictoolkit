/** Unit tests for useSearchParam — the React face of the search-param store.
 *
 *  The whole point is that a component RE-RENDERS when the param changes, including when something
 *  else changed it. A hook that only read the URL would pass a "returns the value" test and still be
 *  broken for the case it exists for. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { type ReactElement } from "react";
import { useSearchParam } from "../hooks/useSearchParam";
import { writeSearchParams } from "../lib/search-params";

function Reader({ name = "item" }: { name?: string }): ReactElement {
  const value = useSearchParam(name);
  return <p data-testid={name}>{value ?? "—"}</p>;
}

describe("useSearchParam", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/board");
  });

  it("reads the param at mount, and `null` when it is absent", () => {
    window.history.replaceState(null, "", "/board?item=w1");
    render(<Reader />);
    expect(screen.getByTestId("item")).toHaveTextContent("w1");

    window.history.replaceState(null, "", "/board");
    render(<Reader name="other" />);
    expect(screen.getByTestId("other")).toHaveTextContent("—");
  });

  it("re-renders when the param is written — the reader need not be the writer", () => {
    render(<Reader />);
    expect(screen.getByTestId("item")).toHaveTextContent("—");

    act(() => writeSearchParams({ item: "w1" }));
    expect(screen.getByTestId("item")).toHaveTextContent("w1");

    act(() => writeSearchParams({ item: null }));
    expect(screen.getByTestId("item")).toHaveTextContent("—");
  });

  it("ignores a write to a DIFFERENT key, since its value did not change", () => {
    window.history.replaceState(null, "", "/board?item=w1");
    render(<Reader />);
    act(() => writeSearchParams({ view: "board" }));
    expect(screen.getByTestId("item")).toHaveTextContent("w1");
  });

  it("re-renders on Back, which changes the same params a write does", () => {
    render(<Reader />);
    window.history.replaceState(null, "", "/board?item=w2");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByTestId("item")).toHaveTextContent("w2");
  });

  it("feeds two readers of the SAME key from one write", () => {
    render(
      <>
        <Reader />
        <Reader name="item" />
      </>,
    );
    act(() => writeSearchParams({ item: "w1" }));
    for (const node of screen.getAllByTestId("item")) expect(node).toHaveTextContent("w1");
  });
});
