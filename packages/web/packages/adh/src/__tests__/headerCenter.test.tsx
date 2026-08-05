import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import {
  HeaderCenterProvider,
  useHeaderCenter,
  useHeaderCenterRegister,
} from "../header/HeaderCenter";

function Host() {
  const register = useHeaderCenterRegister();
  return <div data-testid="slot" ref={register} />;
}

function Guest() {
  const el = useHeaderCenter();
  if (!el) return <span data-testid="waiting" />;
  return createPortal(<span data-testid="portaled">picker</span>, el);
}

describe("the header centre slot", () => {
  it("hands a descendant the registered element, and it portals into it", () => {
    render(
      <HeaderCenterProvider>
        <Host />
        <Guest />
      </HeaderCenterProvider>,
    );
    // The ref fires during commit, so by the time render() returns the guest has re-rendered
    // with the element and its portal is inside the slot — NOT beside it.
    expect(screen.getByTestId("slot")).toContainElement(screen.getByTestId("portaled"));
  });

  it("reads null with no provider, so a consumer outside the shell simply renders nothing", () => {
    render(<Guest />);
    expect(screen.getByTestId("waiting")).toBeInTheDocument();
  });

  it("the register callback is a no-op with no provider", () => {
    let captured: ((el: HTMLElement | null) => void) | undefined;
    function Probe() {
      captured = useHeaderCenterRegister();
      return null;
    }
    render(<Probe />);
    expect(typeof captured).toBe("function");
    expect(() => captured!(document.createElement("div"))).not.toThrow();
  });
});
