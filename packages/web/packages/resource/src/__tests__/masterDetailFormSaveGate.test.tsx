/// <reference types="@testing-library/jest-dom/vitest" />
/**
 * The shared master/detail Save gate — the three things `useMasterDetailForm` owns for every
 * pane built on it:
 *
 *  1. `canSave` means "the draft diverges from what was loaded AND it validates", with the
 *     busy term applied at the BUTTON (`SaveCancelButtons` renders `disabled={!canSave ||
 *     saving}`), never folded into the predicate.
 *  2. `save()` latches its own re-entrancy, because `saving` is a render value and cannot stop a
 *     second activation that lands inside the same commit.
 *  3. The REASON Save is blocked survives — `config.validate` already returns a message, and it
 *     rides out in `actions.blockedReason` for ButtonBar to render beside the button. Before
 *     this it was collapsed to a boolean at the point of use, so eleven panes greyed Save out
 *     with the explanation available and thrown away.
 */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ButtonBar } from "../master-detail/MasterDetailLayout";
import {
  useMasterDetailForm,
  type MasterDetailFormConfig,
} from "../master-detail/useMasterDetailForm";

interface Row {
  id: string;
  name: string;
}
type Draft = { name: string };

const NAME_REQUIRED = "A name is required.";
const ROWS: Row[] = [{ id: "r1", name: "Row One" }];

function makeConfig(
  overrides: Partial<MasterDetailFormConfig<Row, Draft>> = {},
): MasterDetailFormConfig<Row, Draft> {
  return {
    items: ROWS,
    getId: (r) => r.id,
    blank: () => ({ name: "" }),
    toInput: (r) => ({ name: r.name }),
    validate: (d) => (d.name.trim() ? null : NAME_REQUIRED),
    differs: (a, b) => a.name !== b.name,
    create: async (input) => ({ id: "r2", name: input.name }),
    update: async (id, input) => ({ id, name: input.name }),
    refresh: () => {},
    createLabel: "New row",
    ...overrides,
  };
}

describe("useMasterDetailForm — the blocked REASON survives", () => {
  it("hands out the validate message on the first frame of a create", () => {
    const { result } = renderHook(() => useMasterDetailForm(makeConfig()));
    act(() => result.current.actions.onCreate());
    // Not gated on `dirty`: a create opens on a blank draft that is ALREADY blocked, which is
    // exactly when naming the requirement is instruction rather than scolding.
    expect(result.current.dirty).toBe(false);
    expect(result.current.actions.blockedReason).toBe(NAME_REQUIRED);
    expect(result.current.actions.canSave).toBe(false);
  });

  it("clears the reason once the draft validates", () => {
    const { result } = renderHook(() => useMasterDetailForm(makeConfig()));
    act(() => result.current.actions.onCreate());
    act(() => result.current.onChange({ name: "Row Two" }));
    expect(result.current.actions.blockedReason).toBeNull();
    expect(result.current.actions.canSave).toBe(true);
  });

  it("opens an EDIT quiet — a loaded row has nothing blocking Save", () => {
    const { result } = renderHook(() => useMasterDetailForm(makeConfig()));
    act(() => result.current.select("r1"));
    expect(result.current.actions.canSave).toBe(false); // nothing changed yet
    expect(result.current.actions.blockedReason).toBeNull();
  });

  it("names the reason when an edit clears a required field", () => {
    const { result } = renderHook(() => useMasterDetailForm(makeConfig()));
    act(() => result.current.select("r1"));
    act(() => result.current.onChange({ name: "  " }));
    expect(result.current.actions.canSave).toBe(false);
    expect(result.current.actions.blockedReason).toBe(NAME_REQUIRED);
  });

  it("says nothing when no editor is open (there is no Save to explain)", () => {
    const { result } = renderHook(() => useMasterDetailForm(makeConfig()));
    expect(result.current.editing).toBe(false);
    expect(result.current.actions.blockedReason).toBeNull();
  });
});

/** The pane scaffold every consumer reaches Save through: the shared ButtonBar. */
function Harness({ config }: { config: MasterDetailFormConfig<Row, Draft> }) {
  const form = useMasterDetailForm(config);
  return (
    <>
      <button type="button" onClick={() => form.select("r1")}>
        pick row
      </button>
      <ButtonBar actions={form.actions} />
    </>
  );
}

describe("ButtonBar — a grey Save says why", () => {
  it("renders the reason beside a disabled Save on a fresh create", () => {
    render(<Harness config={makeConfig()} />);
    fireEvent.click(screen.getByRole("button", { name: /New row/ }));
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(screen.getByText(NAME_REQUIRED)).toBeInTheDocument();
  });

  it("stays quiet on a loaded row", () => {
    render(<Harness config={makeConfig()} />);
    fireEvent.click(screen.getByRole("button", { name: "pick row" }));
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(screen.queryByText(NAME_REQUIRED)).toBeNull();
  });
});

describe("useMasterDetailForm — canSave carries no busy term", () => {
  it("stays true while a save is in flight", async () => {
    let settle!: (row: Row) => void;
    const create = vi.fn(
      () =>
        new Promise<Row>((res) => {
          settle = res;
        }),
    );
    const { result } = renderHook(() => useMasterDetailForm(makeConfig({ create })));
    act(() => result.current.actions.onCreate());
    act(() => result.current.onChange({ name: "Row Two" }));
    expect(result.current.actions.canSave).toBe(true);

    act(() => {
      void result.current.actions.onSave();
    });
    expect(result.current.actions.saving).toBe(true);
    // `canSave` is a statement about the DRAFT — the draft is still dirty and still valid while
    // the request is out. The in-flight term belongs at the button, where SaveCancelButtons
    // already applies it (`disabled={!canSave || saving}`). Folding `!saving` back in here would
    // flip this to false and express the same rule twice.
    expect(result.current.actions.canSave).toBe(true);

    await act(async () => {
      settle({ id: "r2", name: "Row Two" });
    });
  });
});

describe("useMasterDetailForm — save() latches its own re-entrancy", () => {
  it("ignores a second Save that lands before the disabled state can render", async () => {
    const create = vi.fn(async (input: Draft) => ({ id: "r2", name: input.name }));
    const { result } = renderHook(() => useMasterDetailForm(makeConfig({ create })));
    act(() => result.current.actions.onCreate());
    act(() => result.current.onChange({ name: "Row Two" }));

    // Both activations read the SAME render's `saving === false` — a double-click before React
    // paints the disabled button. Only the ref can stop the second one.
    await act(async () => {
      void result.current.actions.onSave();
      void result.current.actions.onSave();
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("releases the latch so the next save still fires", async () => {
    const update = vi.fn(async (id: string, input: Draft) => ({ id, name: input.name }));
    const { result } = renderHook(() => useMasterDetailForm(makeConfig({ update })));
    act(() => result.current.select("r1"));

    act(() => result.current.onChange({ name: "Edited once" }));
    await act(async () => {
      await result.current.actions.onSave();
    });
    act(() => result.current.onChange({ name: "Edited twice" }));
    await act(async () => {
      await result.current.actions.onSave();
    });
    expect(update).toHaveBeenCalledTimes(2);
  });
});
