import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Olylo } from "./Olylo";
import { EXPRESSIONS, POSES } from "./expressions";

// Smoke tests only: static render guards the SVG structure + public API.
// GSAP/MorphSVG motion is verified in-app (it can't be asserted headless).
describe("Olylo", () => {
  it("renders the ia.olylo.ai mark with eyes, eyebrows, and a mouth path", () => {
    const html = renderToStaticMarkup(<Olylo />);
    expect(html).toContain('aria-label="ia.olylo.ai"');
    expect(html).toContain("<path"); // mouth + descender + brow arcs
    expect(html).toContain("<circle"); // the eyes
    expect(html).toContain("browArcLeft"); // the arc the ia eyebrow text rides
  });

  it("renders for every expression without throwing", () => {
    for (const expression of EXPRESSIONS) {
      const html = renderToStaticMarkup(<Olylo expression={expression} />);
      expect(html).toContain("ia.olylo.ai");
    }
  });

  it("accepts a deliberate gaze direction (eyes-down at an input)", () => {
    const html = renderToStaticMarkup(<Olylo gaze={{ x: 0, y: 1 }} />);
    expect(html).toContain("ia.olylo.ai");
  });
});

// Guards the expression-channel contract (sizes/rotations are applied in-app by
// GSAP and can't be asserted headless, but their pose data can).
describe("POSES expression channels", () => {
  it("defines a pose for every listed expression and vice-versa", () => {
    for (const e of EXPRESSIONS) expect(POSES[e]).toBeDefined();
    expect(Object.keys(POSES).sort()).toEqual([...EXPRESSIONS].sort());
  });

  it("keeps the emotional size channel within a sane ~20% band", () => {
    for (const e of EXPRESSIONS) {
      const s = POSES[e].scale ?? 1;
      expect(s).toBeGreaterThanOrEqual(0.85);
      expect(s).toBeLessThanOrEqual(1.25);
    }
  });

  it("uses spinTurns only as whole turns so the flourish lands cleanly", () => {
    for (const e of EXPRESSIONS) {
      const t = POSES[e].spinTurns ?? 0;
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it("makes 'silly' a rotating mood and 'inquisitive' an asymmetric (one-eye) one", () => {
    expect(POSES.silly.rotation).toBe(180);
    expect((POSES.silly.spinTurns ?? 0)).toBeGreaterThan(0);
    // inquisitive squints exactly one eye — an eyeLeft/eyeRight override present,
    // and the two eyes are not identical.
    const { eyeLeft, eyeRight, eye } = POSES.inquisitive;
    const l = eyeLeft ?? eye;
    const r = eyeRight ?? eye;
    expect(eyeLeft ?? eyeRight).toBeDefined();
    expect(l.scaleY).not.toBe(r.scaleY);
  });
});
