import { describe, expect, it } from "vitest";
import { buildTree, childPathsOf, type TreeFolderNode } from "./tree";
import type { Note, Folder } from "./types";

const note = (path: string, created = 0): Note => ({
  path,
  name: path.split("/").pop()!.replace(/\.md$/, ""),
  title: path.split("/").pop()!.replace(/\.md$/, ""),
  modified: 0,
  created,
});

const folder = (path: string, created = 0): Folder => ({
  path,
  name: path.split("/").pop()!,
  created,
});

describe("buildTree", () => {
  it("nests notes under their folders", () => {
    const notes = [note("/root/top.md"), note("/root/sub/child.md")];
    const folders = [folder("/root/sub")];
    const tree = buildTree(notes, folders, {}, "/root");
    const sub = tree.find((n) => n.kind === "folder") as TreeFolderNode;
    expect(sub.name).toBe("sub");
    expect(sub.children).toHaveLength(1);
  });

  it("includes empty folders", () => {
    const tree = buildTree([], [folder("/root/empty")], {}, "/root");
    expect(tree).toHaveLength(1);
    expect((tree[0] as TreeFolderNode).children).toEqual([]);
  });

  it("defaults to creation date descending", () => {
    const notes = [note("/root/old.md", 100), note("/root/new.md", 200)];
    const tree = buildTree(notes, [], {}, "/root");
    expect(tree.map((n) => (n.kind === "note" ? n.note.name : ""))).toEqual(["new", "old"]);
  });

  it("respects explicit order over creation date", () => {
    const notes = [note("/root/a.md", 200), note("/root/b.md", 100)];
    const order = { "/root/b.md": 0, "/root/a.md": 1 };
    const tree = buildTree(notes, [], order, "/root");
    expect(tree.map((n) => (n.kind === "note" ? n.note.name : ""))).toEqual(["b", "a"]);
  });
});

describe("childPathsOf", () => {
  it("returns ordered sibling paths for a directory", () => {
    const notes = [note("/root/a.md", 100), note("/root/b.md", 200)];
    const folders = [folder("/root/z", 300)];
    // no explicit order → creation desc: z(300), b(200), a(100)
    expect(childPathsOf(notes, folders, {}, "/root")).toEqual(["/root/z", "/root/b.md", "/root/a.md"]);
  });
});
