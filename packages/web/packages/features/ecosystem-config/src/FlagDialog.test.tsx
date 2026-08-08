// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FlagDialog } from "./FeatureFlagsPane";
import type { EcosystemFeatureFlag } from "@agentic-toolkit/data/ecosystem-config";

// The hub vitest config has no global afterEach; tear each render (+ its portalled
// dialog) down explicitly so it doesn't leak into the next test.
afterEach(cleanup);

function saveButton() {
  return screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
}

describe("FlagDialog (create mode) — Save is disabled at mount, enabled after a valid, dirty edit", () => {
  it("is disabled at mount (pristine)", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once a non-colliding key is typed", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. dark_mode"), {
      target: { value: "new_flag" },
    });
    expect(saveButton().disabled).toBe(false);
  });

  it("stays disabled for a key that collides with an existing flag", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. dark_mode"), {
      target: { value: "dark_mode" },
    });
    expect(saveButton().disabled).toBe(true);
  });

  it("stays disabled for a whitespace-only key", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. dark_mode"), {
      target: { value: "   " },
    });
    expect(saveButton().disabled).toBe(true);
  });

  // The gate disables Save, which makes handleSubmit's `throw new Error(...)` unreachable by
  // click — so the message it would have thrown has to be on screen instead, or a colliding key
  // (which looks perfectly valid) greys Save out with no explanation at all.
  it("says WHY Save is blocked for a colliding key", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. dark_mode"), {
      target: { value: "dark_mode" },
    });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("A flag named “dark_mode” already exists.")).toBeTruthy();
  });

  // A whitespace-only key is what `key.trim()` would send — i.e. nothing — so the form is still
  // blocked on the very same requirement, and says so. (Before the create-surfaces-speak ruling
  // this asserted SILENCE, because the reason was gated on `dirty` and a whitespace-only key
  // doesn't read as dirty; that gate is gone, so the sentence stands from mount onward.)
  it("keeps naming the missing key for a whitespace-only key — trimmed, it is still nothing", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. dark_mode"), {
      target: { value: "   " },
    });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("A key is required.")).toBeTruthy();
  });

  it("says WHY Save is grey once the form is dirty but the key is still missing", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("What does this flag gate? (optional)"), {
      target: { value: "gates dark theme" },
    });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("A key is required.")).toBeTruthy();
  });

  // The other half of the rule, and the branch ruling for CREATE surfaces: they speak from the
  // first frame. An untouched dialog is ALREADY blocked (no key yet) and Save is already grey,
  // so waiting for the user to type leaves a dead button unexplained at exactly the moment they
  // are deciding what to fill in — and the key it wants is what they opened this to supply.
  it("says why Save is grey from the FIRST frame — an untouched form is already blocked", () => {
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("A key is required.")).toBeTruthy();
  });

  // …and an EDIT surface still opens quiet, with no `dirty` term needed to keep it that way:
  // a loaded flag has a key already, so there is genuinely no reason to report yet.
  it("says nothing at mount in edit mode — a loaded flag has no blocking reason", () => {
    render(
      <FlagDialog
        open
        flag={{
          key: "dark_mode",
          description: "gates dark theme",
          enabled: true,
          createdAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-01T00:00:00Z",
        }}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clicking Save while enabled calls onCreate with the trimmed key", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <FlagDialog
        open
        flag={null}
        existingKeys={[]}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. dark_mode"), {
      target: { value: "new_flag" },
    });
    fireEvent.click(saveButton());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ key: "new_flag" }),
    );
  });
});

describe("FlagDialog (edit mode) — key field is fixed, so validity never blocks; only dirty gates", () => {
  const FLAG: EcosystemFeatureFlag = {
    key: "dark_mode",
    enabled: false,
    description: "gates dark theme",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };

  it("is disabled at mount (loaded, unedited)", () => {
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the description is edited", () => {
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("What does this flag gate? (optional)"), {
      target: { value: "gates the dark theme, updated" },
    });
    expect(saveButton().disabled).toBe(false);
  });

  // The dirty check has to compare what the SUBMIT sends, and submit sends `description.trim()`.
  // Comparing raw meant a trailing space lit Save up for a PUT with a byte-identical body — the
  // no-op write the whole gate exists to prevent.
  it("a trailing space in the description is not an edit — Save stays grey", () => {
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("What does this flag gate? (optional)"), {
      target: { value: "gates dark theme   " },
    });
    expect(saveButton().disabled).toBe(true);
  });

  it("does not submit via the form's hidden default button when unedited — Enter in any text field activates THIS button, not the visible Save", () => {
    // Pressing Enter in a text input inside a <form> runs the browser's implicit-submission
    // algorithm, which activates the form's default button (the first submit button in tree
    // order) — here that's the hidden <button type="submit"> rendered inside the <form>; the
    // visible "Save" lives in DialogActions, a SIBLING of the form, so it is never the target
    // of implicit submission. Activating a disabled button is a no-op, so this only stays safe
    // if the hidden button carries the same disabled state as the visible one.
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    // The dialog renders through a portal, so query relative to a known in-form element
    // rather than the render()'s own (unportalled) container.
    const form = screen.getByPlaceholderText("What does this flag gate? (optional)").closest("form")!;
    const hiddenSubmit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(hiddenSubmit).not.toBeNull();
    expect(hiddenSubmit.disabled).toBe(true);
    fireEvent.click(hiddenSubmit);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("DOES submit via the hidden default button once dirty — proves the assertion above is a real gate, not a button that's disabled for some other reason", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    const description = screen.getByPlaceholderText("What does this flag gate? (optional)");
    fireEvent.change(description, { target: { value: "gates the dark theme, updated" } });
    const hiddenSubmit = description.closest("form")!.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(hiddenSubmit.disabled).toBe(false);
    fireEvent.click(hiddenSubmit);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("does not fire a SECOND write when Enter is pressed during an in-flight save", () => {
    // DialogActions swaps its whole action row for a spinner while `busy`, so mid-save the
    // hidden default button is the ONLY reachable submit path — and `useAction.run` has no
    // re-entrancy guard of its own. Without a busy term on this button, holding Enter (or a
    // double-tap) issues two PATCHes for one edit.
    const onUpdate = vi.fn(() => new Promise<void>(() => {})); // never settles: stays in-flight
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    const description = screen.getByPlaceholderText("What does this flag gate? (optional)");
    fireEvent.change(description, { target: { value: "gates the dark theme, updated" } });
    const hiddenSubmit = description.closest("form")!.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    fireEvent.click(hiddenSubmit);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    expect(hiddenSubmit.disabled).toBe(true);
    fireEvent.click(hiddenSubmit);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("FlagDialog — Escape on a dirty draft asks before discarding", () => {
  const FLAG: EcosystemFeatureFlag = {
    key: "dark_mode",
    enabled: false,
    description: "gates dark theme",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };

  // Dialog onOpenChange(false) is how Escape, the backdrop, and the × all reach
  // close() — firing Escape here exercises that whole path, not a bespoke one.
  it("does not close on Escape while dirty; Discard then closes", () => {
    const onClose = vi.fn();
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={onClose}
        onDirtyChange={vi.fn()}
      />,
    );
    const description = screen.getByPlaceholderText("What does this flag gate? (optional)");
    fireEvent.change(description, { target: { value: "gates the dark theme, updated" } });

    fireEvent.keyDown(description, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    // The alert is destructive and ignores Escape by design — Discard/Stay is the
    // only way out, which is exactly what this asserts by clicking through it.
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes immediately on Escape when the form is clean — no alert", () => {
    const onClose = vi.fn();
    render(
      <FlagDialog
        open
        flag={FLAG}
        existingKeys={["dark_mode"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={onClose}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("What does this flag gate? (optional)"),
      { key: "Escape" },
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });
});
