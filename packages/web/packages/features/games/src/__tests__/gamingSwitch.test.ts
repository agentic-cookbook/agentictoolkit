import { describe, expect, it } from "vitest";

import { modeAfterGamingOff } from "../GameSettingsPane";

// `mode` is ONE ordered axis — `none` < `gamification` < `game` — and the games site's Enable
// Gaming switch is a two-valued control over it. Which value "off" writes is therefore a real
// decision, and the wrong one is silent: it strips a mode this pane never displays.
describe("modeAfterGamingOff", () => {
  it("returns a gamification product to gamification, not to none", () => {
    // The hazard the rule exists for: a consumer product with gamification support renders the
    // switch OFF (it is not a game). An operator who flips it on to look, then off again, must
    // land back where they started — awards, boards and sheets all hang off `!== 'none'`.
    expect(modeAfterGamingOff("gamification")).toBe("gamification");
  });

  it("switches a dedicated game off entirely", () => {
    expect(modeAfterGamingOff("game")).toBe("none");
  });

  it("leaves an off product off", () => {
    expect(modeAfterGamingOff("none")).toBe("none");
  });

  it("falls back to none before the record has been seeded", () => {
    // The switch does not render unseeded, so this is a guard rather than a path — but the
    // fallback has to be the value that changes nothing, not the one that turns a realm on.
    expect(modeAfterGamingOff(null)).toBe("none");
  });
});
