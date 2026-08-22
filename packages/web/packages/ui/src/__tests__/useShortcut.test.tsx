/** Unit tests for the shortcut registry (hooks/useShortcut).
 *
 *  Keys are dispatched with fireEvent on a real DOM node so they bubble to the registry's single
 *  `document` listener — the same path a real keystroke takes. jsdom reports no Apple platform, so
 *  `mod` resolves to Ctrl unless a case stubs `navigator.platform` (one does; that resolution is
 *  the single most consequential thing the registry decides). */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { type ReactElement } from "react";
import {
  useShortcut,
  useRegisteredShortcuts,
  registerShortcut,
  parseChord,
  chordFromEvent,
  sameChord,
  formatChord,
  isApplePlatform,
  type ShortcutSpec,
} from "../hooks/useShortcut";

/** A component whose only job is to declare one chord. */
function Chord({ spec, run }: { spec: ShortcutSpec; run: () => void }): null {
  useShortcut(spec, run);
  return null;
}

/** Registrations are MODULE state — an unregister leaked by one case would fire in the next. */
const unregisters: Array<() => void> = [];
function register(spec: ShortcutSpec, run: () => void): void {
  unregisters.push(registerShortcut(spec, run));
}
afterEach(() => {
  while (unregisters.length > 0) unregisters.pop()!();
  window.history.replaceState(null, "", "/");
});

/** Stub the platform for one case. jsdom's own navigator says neither Mac nor Windows. */
function withPlatform(platform: string, body: () => void): void {
  const original = Object.getOwnPropertyDescriptor(window.navigator, "platform");
  Object.defineProperty(window.navigator, "platform", { value: platform, configurable: true });
  try {
    body();
  } finally {
    if (original) Object.defineProperty(window.navigator, "platform", original);
    else delete (window.navigator as unknown as Record<string, unknown>).platform;
  }
}

describe("parseChord", () => {
  it("reads modifiers in any order and lowercases the key", () => {
    expect(parseChord("Mod+Shift+Enter")).toMatchObject({
      mod: true,
      shift: true,
      alt: false,
      key: "enter",
      weight: 2,
    });
    expect(parseChord("shift+mod+enter")).toMatchObject({ mod: true, shift: true, key: "enter" });
  });

  it("accepts `option` as a spelling of alt, and the key aliases", () => {
    expect(parseChord("option+up")).toMatchObject({ alt: true, key: "arrowup" });
    expect(parseChord("esc")).toMatchObject({ key: "escape" });
    expect(parseChord("space")).toMatchObject({ key: " " });
  });

  it("recovers `+` as a key, which the separator would otherwise eat", () => {
    expect(parseChord("+")).toMatchObject({ key: "+", weight: 0 });
    expect(parseChord("mod++")).toMatchObject({ mod: true, key: "+" });
  });

  it("counts declared modifiers as weight — the tie-break when two chords match", () => {
    expect(parseChord("k").weight).toBe(0);
    expect(parseChord("mod+k").weight).toBe(1);
    expect(parseChord("mod+shift+k").weight).toBe(2);
  });
});

describe("useShortcut — matching", () => {
  it("fires on the chord and preventDefaults the event", () => {
    const run = vi.fn();
    render(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={run} />);

    const fired = fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
    // `false` from fireEvent means a handler called preventDefault — without it ⌘K would still
    // open the browser's own search bar on top of ours.
    expect(fired).toBe(false);
  });

  it("does NOT fire without the modifier, or with the wrong one", () => {
    const run = vi.fn();
    render(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={run} />);

    fireEvent.keyDown(document.body, { key: "k" });
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true, altKey: true });
    expect(run).not.toHaveBeenCalled();
  });

  it("resolves `mod` to ⌘ on Apple platforms — where Ctrl+K means something else entirely", () => {
    withPlatform("MacIntel", () => {
      expect(isApplePlatform()).toBe(true);
      const run = vi.fn();
      render(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={run} />);

      // Ctrl+K on a Mac is the terminal's delete-to-end-of-line, not this.
      fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
      expect(run).not.toHaveBeenCalled();

      fireEvent.keyDown(document.body, { key: "k", metaKey: true });
      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores a keystroke mid-IME-composition", () => {
    const run = vi.fn();
    render(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={run} />);
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true, isComposing: true });
    expect(run).not.toHaveBeenCalled();
  });

  it("compares shift exactly for a NAMED key, and ignores it for a character key", () => {
    const plain = vi.fn();
    const shifted = vi.fn();
    render(
      <>
        <Chord spec={{ keys: "mod+enter", label: "Save" }} run={plain} />
        <Chord spec={{ keys: "mod+shift+enter", label: "Save and close" }} run={shifted} />
      </>,
    );

    fireEvent.keyDown(document.body, { key: "Enter", ctrlKey: true });
    expect(plain).toHaveBeenCalledTimes(1);
    expect(shifted).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Enter", ctrlKey: true, shiftKey: true });
    expect(shifted).toHaveBeenCalledTimes(1);
    expect(plain).toHaveBeenCalledTimes(1);
  });

  it("matches the CHARACTER, so a layout that needs no shift for `?` still works", () => {
    const run = vi.fn();
    render(<Chord spec={{ keys: "?", label: "Shortcuts" }} run={run} />);
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    fireEvent.keyDown(document.body, { key: "?" });
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("useShortcut — typing", () => {
  function renderWithInput(spec: ShortcutSpec, run: () => void): HTMLInputElement {
    render(
      <>
        <Chord spec={spec} run={run} />
        <input aria-label="Title" />
      </>,
    );
    return screen.getByLabelText("Title") as HTMLInputElement;
  }

  it("holds an UNMODIFIED chord back while focus is in a text field", () => {
    const run = vi.fn();
    const input = renderWithInput({ keys: "?", label: "Shortcuts" }, run);
    fireEvent.keyDown(input, { key: "?" });
    expect(run).not.toHaveBeenCalled();
  });

  it("fires an unmodified chord in a field when allowInInput says so", () => {
    const run = vi.fn();
    const input = renderWithInput({ keys: "?", label: "Shortcuts", allowInInput: true }, run);
    fireEvent.keyDown(input, { key: "?" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("fires a `mod` chord from inside a field — which is the whole point of ⌘K", () => {
    const run = vi.fn();
    const input = renderWithInput({ keys: "mod+k", label: "Open palette" }, run);
    fireEvent.keyDown(input, { key: "k", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("treats a contenteditable as a text field too", () => {
    const run = vi.fn();
    render(
      <>
        <Chord spec={{ keys: "?", label: "Shortcuts" }} run={run} />
        <div contentEditable data-testid="prose" suppressContentEditableWarning />
      </>,
    );
    const prose = screen.getByTestId("prose");
    // jsdom does not implement isContentEditable off the attribute.
    Object.defineProperty(prose, "isContentEditable", { value: true, configurable: true });
    fireEvent.keyDown(prose, { key: "?" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("useShortcut — who wins", () => {
  it("runs exactly ONE handler: the more specific chord", () => {
    const broad = vi.fn();
    const specific = vi.fn();
    render(
      <>
        <Chord spec={{ keys: "mod+k", label: "Open palette" }} run={broad} />
        <Chord spec={{ keys: "mod+shift+k", label: "Open palette, scoped" }} run={specific} />
      </>,
    );
    fireEvent.keyDown(document.body, { key: "K", ctrlKey: true, shiftKey: true });
    expect(specific).toHaveBeenCalledTimes(1);
    expect(broad).not.toHaveBeenCalled();
  });

  it("breaks a tie by most-recently-registered — the dialog that just mounted", () => {
    const page = vi.fn();
    const dialog = vi.fn();
    const { rerender } = render(<Chord spec={{ keys: "mod+k", label: "Page" }} run={page} />);
    rerender(
      <>
        <Chord spec={{ keys: "mod+k", label: "Page" }} run={page} />
        <Chord spec={{ keys: "mod+k", label: "Dialog" }} run={dialog} />
      </>,
    );
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(dialog).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();
  });

  it("loses to a local handler that stops propagation — local beats global", () => {
    const global = vi.fn();
    render(
      <>
        <Chord spec={{ keys: "mod+k", label: "Open palette" }} run={global} />
        <input aria-label="Title" onKeyDown={(e) => e.stopPropagation()} />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "k", ctrlKey: true });
    expect(global).not.toHaveBeenCalled();
  });

  it("stops firing once the declaring component unmounts", () => {
    const run = vi.fn();
    const { unmount } = render(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={run} />);
    unmount();
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(run).not.toHaveBeenCalled();
  });

  it("never fires while `enabled` is false, and fires again when it flips", () => {
    const run = vi.fn();
    const { rerender } = render(
      <Chord spec={{ keys: "mod+k", label: "Open palette", enabled: false }} run={run} />,
    );
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(run).not.toHaveBeenCalled();

    rerender(<Chord spec={{ keys: "mod+k", label: "Open palette", enabled: true }} run={run} />);
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs the LATEST closure without re-registering on every render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={first} />);
    rerender(<Chord spec={{ keys: "mod+k", label: "Open palette" }} run={second} />);
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("useRegisteredShortcuts", () => {
  function Sheet(): ReactElement {
    const shortcuts = useRegisteredShortcuts();
    return (
      <ul aria-label="Shortcuts">
        {shortcuts.map((s) => (
          <li key={`${s.group}:${s.keys}`}>{`${s.group ?? "—"} · ${s.keys} · ${s.label}`}</li>
        ))}
      </ul>
    );
  }

  it("lists what is registered, and drops it again on unmount", () => {
    const { rerender } = render(
      <>
        <Sheet />
        <Chord spec={{ keys: "mod+k", label: "Open palette", group: "Global" }} run={vi.fn()} />
      </>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Global · mod+k · Open palette");

    rerender(<Sheet />);
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("omits hidden and disabled chords — they still fire, they just are not advertised", () => {
    render(
      <>
        <Sheet />
        <Chord spec={{ keys: "mod+k", label: "Open palette", hidden: true }} run={vi.fn()} />
        <Chord spec={{ keys: "mod+j", label: "Jump", enabled: false }} run={vi.fn()} />
        <Chord spec={{ keys: "?", label: "Shortcuts" }} run={vi.fn()} />
      </>,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("— · ? · Shortcuts");
  });

  it("sees a shortcut registered imperatively, outside React", () => {
    render(<Sheet />);
    expect(screen.queryByRole("listitem")).toBeNull();
    act(() => register({ keys: "mod+p", label: "Print", group: "Global" }, vi.fn()));
    expect(screen.getByRole("listitem")).toHaveTextContent("Global · mod+p · Print");
  });
});

describe("formatChord", () => {
  it("spells a chord the way the running platform does", () => {
    withPlatform("MacIntel", () => {
      expect(formatChord("mod+k")).toBe("⌘K");
      expect(formatChord("mod+shift+enter")).toBe("⌘⇧Enter");
      expect(formatChord("option+up")).toBe("⌥↑");
    });
    withPlatform("Win32", () => {
      expect(formatChord("mod+k")).toBe("Ctrl+K");
      expect(formatChord("mod+shift+enter")).toBe("Ctrl+Shift+Enter");
      expect(formatChord("escape")).toBe("Esc");
    });
  });
});

describe("chordFromEvent", () => {
  /** A keydown as the recorder sees it — handed straight to chordFromEvent, never dispatched. */
  function press(init: KeyboardEventInit): KeyboardEvent {
    return new KeyboardEvent("keydown", init);
  }

  it("returns null for a bare modifier — the user is mid-chord, not done", () => {
    for (const key of ["Meta", "Control", "Shift", "Alt", "AltGraph", "CapsLock"]) {
      expect(chordFromEvent(press({ key }))).toBeNull();
    }
  });

  it("refuses Escape and Tab, whatever is held — they are how you leave the recorder", () => {
    withPlatform("MacIntel", () => {
      expect(chordFromEvent(press({ key: "Escape" }))).toBeNull();
      expect(chordFromEvent(press({ key: "Tab" }))).toBeNull();
      expect(chordFromEvent(press({ key: "Escape", metaKey: true, shiftKey: true }))).toBeNull();
      expect(chordFromEvent(press({ key: "Tab", metaKey: true, altKey: true }))).toBeNull();
    });
  });

  it("spells the command modifier as `mod`, per platform", () => {
    withPlatform("MacIntel", () => {
      expect(chordFromEvent(press({ key: "k", metaKey: true }))).toBe("mod+k");
    });
    withPlatform("Win32", () => {
      expect(chordFromEvent(press({ key: "k", ctrlKey: true }))).toBe("mod+k");
    });
  });

  it("returns null for the NON-command modifier, which matchesEvent would refuse anyway", () => {
    withPlatform("MacIntel", () => {
      expect(chordFromEvent(press({ key: "k", ctrlKey: true }))).toBeNull();
    });
    withPlatform("Win32", () => {
      expect(chordFromEvent(press({ key: "k", metaKey: true }))).toBeNull();
    });
  });

  it("lowercases the key and orders the modifiers mod, alt, shift", () => {
    withPlatform("MacIntel", () => {
      expect(chordFromEvent(press({ key: "K", metaKey: true, altKey: true, shiftKey: true }))).toBe(
        "mod+alt+shift+k",
      );
    });
  });

  it("emits shift only where matchesEvent reads it", () => {
    withPlatform("MacIntel", () => {
      // A bare character already records that shift was held — "?", never "shift+/".
      expect(chordFromEvent(press({ key: "?", shiftKey: true }))).toBe("?");
      // A NAMED key does not, so shift has to be spelled out.
      expect(chordFromEvent(press({ key: "Enter", shiftKey: true }))).toBe("shift+enter");
      // Alongside a modifier it is meaningful even for a character.
      expect(chordFromEvent(press({ key: "K", metaKey: true, shiftKey: true }))).toBe("mod+shift+k");
    });
  });

  it("spells the space key, which the `+` split cannot carry", () => {
    withPlatform("MacIntel", () => {
      expect(chordFromEvent(press({ key: " ", metaKey: true }))).toBe("mod+space");
    });
  });

  it("is the inverse of parseChord: the recorded chord fires on the event it came from", () => {
    withPlatform("MacIntel", () => {
      for (const init of [
        { key: "K", metaKey: true, shiftKey: true },
        { key: "Enter", shiftKey: true },
        { key: " ", metaKey: true },
        { key: "?", shiftKey: true },
        { key: "j", metaKey: true, altKey: true },
      ] satisfies KeyboardEventInit[]) {
        const keys = chordFromEvent(press(init));
        expect(keys).not.toBeNull();
        const run = vi.fn();
        const off = registerShortcut({ keys: keys!, label: "Recorded" }, run);
        fireEvent.keyDown(document.body, init);
        off();
        expect(run, `${keys} should fire on the event it was recorded from`).toHaveBeenCalledTimes(
          1,
        );
      }
    });
  });
});

describe("sameChord", () => {
  it("compares the parsed chords, so neither spelling has to be canonical", () => {
    expect(sameChord("mod+shift+k", "shift+mod+K")).toBe(true);
    expect(sameChord("option+up", "alt+arrowup")).toBe(true);
    expect(sameChord("esc", "escape")).toBe(true);
  });

  it("separates chords that differ by a modifier or a key", () => {
    expect(sameChord("mod+k", "mod+shift+k")).toBe(false);
    expect(sameChord("mod+k", "alt+k")).toBe(false);
    expect(sameChord("mod+k", "mod+j")).toBe(false);
  });
});
