/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { CategoryGearMenu } from "../blocks/category-gear-menu"

async function openMenu(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Category actions" }))
  await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument())
}

async function openMenuWithNoun(noun: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: `${noun.charAt(0).toUpperCase() + noun.slice(1)} actions` }))
  await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument())
}

describe("CategoryGearMenu", () => {
  it("offers add, rename, move, file and delete", async () => {
    render(<CategoryGearMenu targetName="Q3" canEditTarget onAction={vi.fn()} />)
    await openMenu()
    for (const label of [
      `Add category…`,
      `Rename “Q3”…`,
      `Move “Q3”…`,
      `Also file “Q3” in…`,
      `Delete “Q3”…`,
    ]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument()
    }
  })

  // The two verbs differ in what they LEAVE BEHIND, and the menu is where that has to be
  // legible — after the dialog opens the user has already chosen. "Also file … in" is written
  // to be unmistakable beside "Move": the adverb says the old place survives, and the
  // preposition says the ellipsis is asking for a place rather than for a confirmation.
  it("distinguishes filing from moving in the item itself", async () => {
    const onAction = vi.fn()
    render(<CategoryGearMenu targetName="Q3" canEditTarget onAction={onAction} />)
    await openMenu()
    const file = screen.getByRole("menuitem", { name: `Also file “Q3” in…` })
    expect(file).not.toHaveTextContent(/^Move/)
    fireEvent.click(file)
    expect(onAction).toHaveBeenCalledWith("file")
  })

  it("reports which action was chosen", async () => {
    const onAction = vi.fn()
    render(<CategoryGearMenu targetName="Q3" canEditTarget onAction={onAction} />)
    await openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: `Move “Q3”…` }))
    expect(onAction).toHaveBeenCalledWith("move")
  })

  it("leaves add enabled but disables the target actions with nothing selected", async () => {
    render(<CategoryGearMenu targetName={null} canEditTarget={false} onAction={vi.fn()} />)
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Add category…" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    )
    for (const label of ["Rename…", "Move…", "Also file in…", "Delete…"]) {
      expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("takes the host's noun", async () => {
    render(<CategoryGearMenu targetName={null} canEditTarget={false} noun="folder" onAction={vi.fn()} />)
    await openMenuWithNoun("folder")
    expect(screen.getByRole("menuitem", { name: "Add folder…" })).toBeInTheDocument()
  })
})
