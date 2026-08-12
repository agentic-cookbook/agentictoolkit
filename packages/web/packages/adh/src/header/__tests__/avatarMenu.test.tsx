import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarMenu } from "../AvatarMenu";

const user = { name: "Mike Fullerton", fullName: "Mike Fullerton" };

describe("AvatarMenu", () => {
  it("names the settings row 'User Settings'", async () => {
    render(<AvatarMenu user={user} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    expect(await screen.findByText("User Settings")).toBeInTheDocument();
    expect(screen.queryByText(/^Settings$/)).not.toBeInTheDocument();
  });

  it("omits the row entirely when the host offers no settings surface", async () => {
    render(<AvatarMenu user={user} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    expect(screen.queryByText("User Settings")).not.toBeInTheDocument();
  });

  it("still shows exactly the four closed rows", async () => {
    render(<AvatarMenu user={user} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    expect(await screen.findByText("Welcome Mike!")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("User Settings")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });
});
