/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { ErrorText, DialogErrorText } from "../components/error-text"

/**
 * The two inline error lines are ONE treatment in two elements. `DialogErrorText` exists
 * solely because a `<p>` may not nest inside `DialogDescription`'s `<p>` — the element is the
 * only thing the rule forces, and its own docblock says it is "rather than a second
 * treatment". A different colour token here means two consecutive failures of the same kind
 * (a rename the server refused, then a delete it refused) render in two different reds
 * wherever the theme's `--destructive` and `--apt-red` differ.
 */
describe("ErrorText / DialogErrorText", () => {
  it("paints the dialog error the same colour and size as every other inline error", () => {
    render(
      <>
        <ErrorText error="Name already taken." />
        <DialogErrorText error="That did not work." />
      </>,
    )
    const [inline, inDialog] = screen.getAllByRole("alert")
    for (const el of [inline!, inDialog!]) {
      expect(el).toHaveClass("text-sm")
      expect(el).toHaveClass("text-apt-red")
      expect(el.className).not.toContain("text-destructive")
    }
  })

  it("keeps the elements different — a span in the dialog, a paragraph everywhere else", () => {
    render(
      <>
        <ErrorText error="Name already taken." />
        <DialogErrorText error="That did not work." />
      </>,
    )
    const [inline, inDialog] = screen.getAllByRole("alert")
    expect(inline!.tagName).toBe("P")
    expect(inDialog!.tagName).toBe("SPAN")
    expect(inDialog!).toHaveClass("block")
  })

  it("renders nothing without an error", () => {
    render(
      <>
        <ErrorText error={null} />
        <DialogErrorText error={undefined} />
      </>,
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
