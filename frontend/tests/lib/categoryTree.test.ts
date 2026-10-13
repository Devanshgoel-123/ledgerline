import { describe, expect, it } from "vitest";
import { categoryWithDescendants } from "@/helpers/categoryTree";

const categories = [
  { slug: "travel" },
  { slug: "rides", meta: { parent: "travel" } },
  { slug: "stays", meta: { parent: "travel" } },
  { slug: "airport-cabs", meta: { parent: "rides" } },
  { slug: "food" },
];

describe("categoryWithDescendants", () => {
  it("includes every subcategory at any depth", () => {
    expect([...categoryWithDescendants("travel", categories)].sort()).toEqual([
      "airport-cabs",
      "rides",
      "stays",
      "travel",
    ]);
  });

  it("returns just the category when it has no children", () => {
    expect([...categoryWithDescendants("food", categories)]).toEqual(["food"]);
  });
});
