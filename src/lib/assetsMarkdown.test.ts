import { describe, expect, it } from "vitest";
import { toDisplay, toStorage } from "./assetsMarkdown";

const prefix = "asset://localhost/Users/x/quipu/assets/";

describe("assetsMarkdown", () => {
  it("rewrites stored paths to display URLs", () => {
    const stored = "text ![a](.assets/one.png) more";
    expect(toDisplay(stored, prefix)).toBe(`text ![a](${prefix}one.png) more`);
  });

  it("rewrites display URLs back to stored paths", () => {
    const display = `![a](${prefix}one.png)`;
    expect(toStorage(display, prefix)).toBe("![a](.assets/one.png)");
  });

  it("round-trips losslessly", () => {
    const stored = "![a](.assets/one.png) and ![b](.assets/two.jpg)";
    expect(toStorage(toDisplay(stored, prefix), prefix)).toBe(stored);
  });

  it("leaves non-asset links untouched", () => {
    const md = "[link](https://example.com) and ![](.assets/x.png)";
    const display = toDisplay(md, prefix);
    expect(display).toContain("https://example.com");
    expect(display).toContain(`${prefix}x.png`);
  });
});
