// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BagDialog } from "./ServerBagsPane";
import type { EcosystemServerBag } from "@agentic-toolkit/data/ecosystem-config";

// The hub vitest config has no global afterEach; tear each render (+ its portalled
// dialog) down explicitly so it doesn't leak into the next test.
afterEach(cleanup);

function saveButton() {
  return screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
}

describe("BagDialog (create mode) — Save is disabled at mount, enabled after a valid, dirty edit", () => {
  it("is disabled at mount (pristine)", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("stays disabled once dirty with unparseable JSON in the value field", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. onboarding_config"), {
      target: { value: "new_bag" },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "{not json" },
    });
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once a non-colliding key and valid JSON are both present", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. onboarding_config"), {
      target: { value: "new_bag" },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "42" },
    });
    expect(saveButton().disabled).toBe(false);
  });

  it("stays disabled for a key that collides with an existing bag", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. onboarding_config"), {
      target: { value: "onboarding_config" },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "42" },
    });
    expect(saveButton().disabled).toBe(true);
  });

  // The gate disables Save, which makes handleSubmit's `throw new Error(...)` unreachable by
  // click — so the message it would have thrown has to be on screen instead, or a colliding key
  // (which looks perfectly valid) greys Save out with no explanation at all.
  it("says WHY Save is blocked for a colliding key", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. onboarding_config"), {
      target: { value: "onboarding_config" },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "42" },
    });
    expect(saveButton().disabled).toBe(true);
    expect(
      screen.getByText("A bag named “onboarding_config” already exists."),
    ).toBeTruthy();
  });

  it("says WHY Save is blocked for unparseable JSON", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "{not json" },
    });
    expect(saveButton().disabled).toBe(true);
    expect(
      screen.getByText('Value must be valid JSON — e.g. true, 42, "text", or {"a": 1}.'),
    ).toBeTruthy();
  });

  // The other half of the rule, and the branch ruling for CREATE surfaces: they speak from the
  // first frame. An untouched create form is ALREADY blocked (an empty value box isn't valid
  // JSON) and Save is already grey, so staying quiet until the user types leaves a dead button
  // unexplained at exactly the moment they are deciding what to fill in — and what it is blocked
  // on is precisely what they opened the dialog to supply.
  it("says why Save is grey from the FIRST frame — an untouched create form is already blocked", () => {
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(/Value must be valid JSON/)).toBeTruthy();
  });

  // …and an EDIT surface still opens quiet, with no `dirty` term needed to keep it that way:
  // a loaded bag is valid, so there is genuinely no reason to report yet.
  it("says nothing at mount in edit mode — a loaded bag has no blocking reason", () => {
    render(
      <BagDialog
        open
        bag={{
          key: "onboarding_config",
          value: true,
          description: "gates onboarding",
          createdAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-01T00:00:00Z",
        }}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clicking Save while enabled calls onCreate with the trimmed key and parsed value", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <BagDialog
        open
        bag={null}
        existingKeys={[]}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. onboarding_config"), {
      target: { value: "new_bag" },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "42" },
    });
    fireEvent.click(saveButton());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ key: "new_bag", value: 42 }),
    );
  });
});

describe("BagDialog (edit mode) — key field is fixed; JSON validity still gates Save", () => {
  const BAG: EcosystemServerBag = {
    key: "onboarding_config",
    value: true,
    description: "gates onboarding",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };

  it("is disabled at mount (loaded, unedited)", () => {
    render(
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("enables once the JSON value is edited to different, still-valid JSON", () => {
    render(
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "false" },
    });
    expect(saveButton().disabled).toBe(false);
  });

  // The dirty check has to compare what the SUBMIT sends, and submit sends `description.trim()`.
  // Comparing raw meant a trailing space lit Save up for a PUT with a byte-identical body — the
  // no-op write the whole gate exists to prevent.
  it("a trailing space in the description is not an edit — Save stays grey", () => {
    render(
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("What does this configure? (optional)"), {
      target: { value: "gates onboarding  " },
    });
    expect(saveButton().disabled).toBe(true);
  });

  it("disables again once edited to invalid JSON", () => {
    render(
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. { "maxItems": 20 }'), {
      target: { value: "{bad" },
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
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    const valueField = screen.getByPlaceholderText('e.g. { "maxItems": 20 }');
    const hiddenSubmit = valueField.closest("form")!.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(hiddenSubmit).not.toBeNull();
    expect(hiddenSubmit.disabled).toBe(true);
    fireEvent.click(hiddenSubmit);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("DOES submit via the hidden default button once dirty — proves the assertion above is a real gate, not a button that's disabled for some other reason", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    const valueField = screen.getByPlaceholderText('e.g. { "maxItems": 20 }');
    fireEvent.change(valueField, { target: { value: "false" } });
    const hiddenSubmit = valueField.closest("form")!.querySelector(
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
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    const valueField = screen.getByPlaceholderText('e.g. { "maxItems": 20 }');
    fireEvent.change(valueField, { target: { value: "false" } });
    const hiddenSubmit = valueField.closest("form")!.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    fireEvent.click(hiddenSubmit);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    expect(hiddenSubmit.disabled).toBe(true);
    fireEvent.click(hiddenSubmit);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("BagDialog — Escape on a dirty draft asks before discarding", () => {
  const BAG: EcosystemServerBag = {
    key: "onboarding_config",
    value: true,
    description: "gates onboarding",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };

  // Dialog onOpenChange(false) is how Escape, the backdrop, and the × all reach
  // close() — firing Escape here exercises that whole path, not a bespoke one.
  it("does not close on Escape while dirty; Discard then closes", () => {
    const onClose = vi.fn();
    render(
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={onClose}
        onDirtyChange={vi.fn()}
      />,
    );
    const description = screen.getByPlaceholderText("What does this configure? (optional)");
    fireEvent.change(description, { target: { value: "gates onboarding for new orgs" } });

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
      <BagDialog
        open
        bag={BAG}
        existingKeys={["onboarding_config"]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={onClose}
        onDirtyChange={vi.fn()}
      />,
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("What does this configure? (optional)"),
      { key: "Escape" },
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });
});
