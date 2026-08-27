import { describe, expect, it } from "vitest";
import { abbreviateHome } from "./path";

describe("abbreviateHome", () => {
  it("replaces the home dir with ~", () => {
    expect(abbreviateHome("/Users/x/Desktop/quipu", "/Users/x")).toBe("~/Desktop/quipu");
  });

  it("handles a trailing slash on home", () => {
    expect(abbreviateHome("/Users/x/Desktop/quipu", "/Users/x/")).toBe("~/Desktop/quipu");
  });

  it("abbreviates the home dir itself", () => {
    expect(abbreviateHome("/Users/x", "/Users/x")).toBe("~");
  });

  it("only matches on a path boundary", () => {
    expect(abbreviateHome("/Users/xtra/notes", "/Users/x")).toBe("/Users/xtra/notes");
  });

  it("returns the path unchanged when home is empty", () => {
    expect(abbreviateHome("/quipu", "")).toBe("/quipu");
  });
});
