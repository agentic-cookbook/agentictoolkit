import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsLayout, type Topic } from "./SettingsLayout";
import { useSettingsNav } from "./settings-nav";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const topics: Topic[] = [
  { id: "a", label: "Alpha", href: "/settings/a", content: <p>alpha body</p> },
  { id: "b", label: "Beta", href: "/settings/b", content: <p>beta body</p> },
];

describe("SettingsLayout", () => {
  it("renders the active topic's content", () => {
    render(<SettingsLayout topics={topics} activeId="b" />);
    expect(screen.getByText("beta body")).toBeInTheDocument();
  });

  it("hands a controlled caller the topic instead of routing", async () => {
    const onNavigate = vi.fn();
    render(<SettingsLayout topics={topics} activeId="a" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onNavigate).toHaveBeenCalledWith(topics[1]);
  });

  // What AccountPanel's "go to Notifications" now rides on. It must reach the SAME switcher
  // the rail buttons use — a panel that navigated by href instead 404'd on 44 of 45 sites,
  // where the section has no URL at all (see settings-nav.tsx).
  it("lets a panel inside it switch to a sibling section", async () => {
    const onNavigate = vi.fn();
    function JumpToBeta() {
      const nav = useSettingsNav();
      return (
        <button type="button" onClick={() => nav?.goToTopic("b")}>
          jump
        </button>
      );
    }
    const withPanel: Topic[] = [{ ...topics[0]!, content: <JumpToBeta /> }, topics[1]!];
    render(<SettingsLayout topics={withPanel} activeId="a" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: "jump" }));
    expect(onNavigate).toHaveBeenCalledWith(withPanel[1]);
  });

  it("hands a panel rendered outside it no switcher, rather than a silent no-op", () => {
    function Probe() {
      return <span>{useSettingsNav() === null ? "no rail" : "has rail"}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("no rail")).toBeInTheDocument();
  });
});
