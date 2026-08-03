// The CHILD-ecosystem dialog's validator. Its `prefix` is the parent's own address — the
// same string the field previews — because both the grammar check and the taken-check are
// questions about the address the server will actually derive, and for years this form asked
// them about a root-shaped `ecosystem.<leaf>` instead.
import { describe, it, expect } from "vitest";
import { ecoBlank, ecoValidate, rehangIdentifier } from "./EcosystemDetail";

const draft = (identifier: string) => ({ ...ecoBlank(), identifier, name: "Sub" });

describe("ecoValidate", () => {
  it("accepts a leaf hung off the parent's address", () => {
    expect(ecoValidate(draft("ecosystem.fishlamp.adh"), [], "ecosystem.fishlamp.")).toBeNull();
  });

  it("refuses an identifier that is not under the parent, naming the real shape", () => {
    expect(ecoValidate(draft("ecosystem.adh"), [], "ecosystem.fishlamp.")).toBe(
      "Identifier must be ecosystem.fishlamp.<name>, e.g. ecosystem.fishlamp.my-ecosystem",
    );
  });

  it("refuses a DOTTED leaf — what follows the prefix is one segment", () => {
    expect(ecoValidate(draft("ecosystem.fishlamp.a.b"), [], "ecosystem.fishlamp.")).toMatch(
      /must be ecosystem\.fishlamp\./,
    );
  });

  it("catches a genuine collision with a SIBLING under the same parent", () => {
    expect(
      ecoValidate(draft("ecosystem.fishlamp.adh"), ["ecosystem.fishlamp.adh"], "ecosystem.fishlamp."),
    ).toBe('Identifier "ecosystem.fishlamp.adh" is already in use.');
  });

  // The defect the prefix parameter exists for: with the old hardcoded `ecosystem.` the draft
  // read `ecosystem.adh`, which collided with an unrelated ROOT the caller happens to own — and
  // every product minted before address derivation moved to the parent chain is such a root.
  it("does NOT block a child create because an unrelated ROOT shares the leaf", () => {
    expect(
      ecoValidate(draft("ecosystem.fishlamp.adh"), ["ecosystem.adh"], "ecosystem.fishlamp."),
    ).toBeNull();
  });

  it("still validates a ROOT create against the root shape", () => {
    expect(ecoValidate(draft("ecosystem.adh"), [], "ecosystem.")).toBeNull();
    expect(ecoValidate(draft("ecosystem.adh"), ["ecosystem.adh"], "ecosystem.")).toMatch(
      /already in use/,
    );
  });

  it("refuses every draft while the parent is unresolved — there is no address to judge", () => {
    expect(ecoValidate(draft("ecosystem.adh"), [], "")).toMatch(/working out where/i);
  });

  it("requires an identifier, then a name", () => {
    expect(ecoValidate(draft(""), [], "ecosystem.")).toBe("Identifier is required.");
    expect(
      ecoValidate({ ...ecoBlank(), identifier: "ecosystem.adh" }, [], "ecosystem."),
    ).toBe("Name is required.");
  });
});

describe("rehangIdentifier", () => {
  // What the create dialog's top-level toggle does, and what the field does for itself when the
  // home-ecosystem lookup lands after the user has already typed. Without it the draft keeps
  // hanging off the OLD parent while the field displays it as the leaf — so the row reads exactly
  // right and ecoValidate refuses it, naming the shape already on screen.
  it("moves a typed leaf from one parent to another", () => {
    expect(
      rehangIdentifier("ecosystem.fishlamp.adh.foo", "ecosystem.fishlamp.adh.", "ecosystem.fishlamp."),
    ).toBe("ecosystem.fishlamp.foo");
  });

  it("treats an identifier typed under NO prefix as all leaf — the unresolved-parent case", () => {
    expect(rehangIdentifier("foo", "", "ecosystem.fishlamp.")).toBe("ecosystem.fishlamp.foo");
  });

  it("treats an identifier that does not start with the old prefix as all leaf", () => {
    expect(rehangIdentifier("foo", "ecosystem.other.", "ecosystem.fishlamp.")).toBe(
      "ecosystem.fishlamp.foo",
    );
  });

  it("keeps an empty draft empty when there is no prefix on either side", () => {
    expect(rehangIdentifier("", "", "")).toBe("");
  });

  // Idempotent under a repeat: re-hanging an already-moved identifier off the SAME pair is what
  // the field's effect would do on top of the toggle's synchronous move, and it must not stack
  // a second prefix on.
  it("is a no-op when the identifier already hangs off the target prefix", () => {
    const moved = rehangIdentifier("ecosystem.a.foo", "ecosystem.a.", "ecosystem.b.");
    expect(rehangIdentifier(moved, "ecosystem.b.", "ecosystem.b.")).toBe("ecosystem.b.foo");
  });
});
