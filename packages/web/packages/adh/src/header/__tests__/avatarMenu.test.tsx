import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarMenu } from "../AvatarMenu";

const user = { name: "Mike Fullerton", fullName: "Mike Fullerton" };
// A slug is data on the account, but it no longer turns the Profile row on by itself —
// see AvatarMenuProps.profileHref. Kept as a separate fixture rather than added to
// `user` above, so a case that renders with a slug but no profileHref still proves
// slug-alone is not the gate.
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

  it("still shows exactly the five closed rows, when the caller supplies profileHref", async () => {
    render(
      <AvatarMenu
        user={userWithSlug}
        profileHref="/mikefullerton/profile"
        onSettings={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
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

  it("omits Profile when the account has a slug but the caller withholds profileHref — this site carries no /<slug>/profile route", async () => {
    render(<AvatarMenu user={userWithSlug} onSettings={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    expect(await screen.findByText("Welcome Mike!")).toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("points the Profile row at whatever href the caller supplies", async () => {
    render(
      <AvatarMenu
        user={userWithSlug}
        profileHref="/mikefullerton/profile"
        onSettings={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Mike Fullerton menu" }));
    // The row's accessible role is "menuitem", not "link": Base UI's MenuLinkItem renders an
    // `<a>` but assigns it the ARIA menuitem role (the WAI-ARIA menu pattern requires every
    // child of role="menu" to expose role="menuitem", regardless of the underlying element) —
    // so `getByRole("link", …)` never matches a row inside this popup.
    const link = await screen.findByRole("menuitem", { name: "Profile" });
    expect(link.getAttribute("href")).toBe("/mikefullerton/profile");
  });

  it("places Profile between Home and Settings", async () => {
    render(
      <AvatarMenu
        user={userWithSlug}
        profileHref="/mikefullerton/profile"
        onSettings={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
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
