import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Olylo } from "./Olylo";
import { EXPRESSIONS } from "./expressions";

// Smoke tests only: static render guards the SVG structure + public API.
// GSAP/MorphSVG motion is verified in-app (it can't be asserted headless).
describe("Olylo", () => {
  it("renders the ia.olylo.ai mark with eyes, vector eyebrows, and a mouth path", () => {
    const html = renderToStaticMarkup(<Olylo />);
    expect(html).toContain('aria-label="ia.olylo.ai"');
    expect(html).toContain("<path"); // the morphing mouth
    expect(html).toContain("<circle"); // the eyes (and eyebrow i-dots)
    expect(html).toContain("<ellipse"); // the eyebrow 'a' bowls
  });

  it("renders for every expression without throwing", () => {
    for (const expression of EXPRESSIONS) {
      const html = renderToStaticMarkup(<Olylo expression={expression} />);
      expect(html).toContain("ia.olylo.ai");
    }
  });
});
