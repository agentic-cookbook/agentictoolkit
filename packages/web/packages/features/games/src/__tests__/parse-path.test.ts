import { describe, expect, it } from "vitest";
import { parseGamesPath } from "../parse-path";

describe("parseGamesPath", () => {
  it("treats no path as nothing selected", () => {
    expect(parseGamesPath()).toEqual({});
    expect(parseGamesPath([])).toEqual({});
  });

  it("treats the reserved `all` segment as nothing selected", () => {
    expect(parseGamesPath(["all"])).toEqual({ all: true });
  });

  it("treats the reserved `new` segment as the create dialog", () => {
    expect(parseGamesPath(["new"])).toEqual({ creating: true });
  });

  it("reads a game id from the first segment", () => {
    expect(parseGamesPath(["game.acme.cavern"])).toEqual({ activeGameId: "game.acme.cavern" });
  });

  it("reads the topic, leaf and member entity positionally", () => {
    expect(parseGamesPath(["g1", "content", "def-3", "child-9"])).toEqual({
      activeGameId: "g1",
      activeTopic: "content",
      activeLeafId: "def-3",
      activeMemberEntityId: "child-9",
    });
  });

  it("ignores anything past the fifth segment", () => {
    expect(parseGamesPath(["g1", "content", "def-3", "child-9", "junk"])).toEqual({
      activeGameId: "g1",
      activeTopic: "content",
      activeLeafId: "def-3",
      activeMemberEntityId: "child-9",
    });
  });

  // The reservation is only safe because a game id can never BE these strings — it is an
  // rdid (`game.<eco>.<slug>`) or a uuid. A bare `new` in the first position is the dialog.
  it("does not confuse a game whose slug ends in `new`", () => {
    expect(parseGamesPath(["game.acme.new"])).toEqual({ activeGameId: "game.acme.new" });
  });
});
