import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarMenu } from "../AvatarMenu";

const user = { name: "Mike Fullerton", fullName: "Mike Fullerton" };
// A slug is what turns the Profile row on — see AvatarMenuUser. Kept as a separate
// fixture rather than added to `user` above, so the no-slug case below still proves
// what it claims to prove.
const userWithSlug = { ...user, slug: "mikefullerton" };

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

  it("still shows exactly the five closed rows, when the account has a slug", async () => {
    render(<AvatarMenu user={userWithSlug} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    expect(await screen.findByText("Welcome Mike!")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("User Settings")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("shows four rows, with no Profile, when the account has no slug — there is no profile address to link to", async () => {
    render(<AvatarMenu user={user} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    expect(await screen.findByText("Welcome Mike!")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.getByText("User Settings")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("points the Profile row at /<slug>/profile on the site under test", async () => {
    render(<AvatarMenu user={userWithSlug} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    const link = await screen.findByRole("link", { name: "Profile" });
    expect(link.getAttribute("href")).toBe("/mikefullerton/profile");
  });

  it("places Profile between Home and Settings", async () => {
    render(<AvatarMenu user={userWithSlug} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    await screen.findByText("Profile");
    // Position is the requirement, not merely presence: every other case here queries by text or
    // role and would pass just as happily with Profile moved below Log out. Reading indices out of
    // the rendered text is what makes a reordering fail — the rows are siblings in DOM order, so
    // document order IS visual order.
    const text = document.body.textContent ?? "";
    expect(text.indexOf("Profile")).toBeGreaterThan(text.indexOf("Home"));
    expect(text.indexOf("Profile")).toBeLessThan(text.indexOf("User Settings"));
  });
});
