import { describe, expect, it } from "vitest";
import { entriesCsv } from "@/core/csv";
import { BUILT_IN_CATEGORIES, categoryTree, PROVIDERS, slugForLabel } from "@/core/catalog";
import { CATEGORY_SLUGS } from "@shared/enums/category.js";
import { classify, ruleFor } from "@/core/classify";
import { evenShares, friendBalances } from "@/core/people";
import { sampleEntries } from "@/core/sample";
import { exportBackup, parseBackup, restoreBackup } from "@/db/backup";
import {
  addCustomCategory,
  addEntries,
  addEntry,
  deleteCustomCategory,
  deleteEntry,
  eraseEverything,
  getSetting,
  listCustomCategories,
  listEntries,
  listRules,
  removeSamples,
  saveRule,
  setSetting,
  setShareSettled,
  settleFriend,
  updateEntry,
  type EntryInput,
} from "@/db/repo";
import { testDb } from "./helpers/nodeDb";

const dinner: EntryInput = {
  date: "2026-10-20",
  amount: 1800,
  type: "debit",
  description: "Dinner at Toit",
  categorySlug: "dinner",
  method: "upi",
  splits: [
    { name: "Asha", amount: 600 },
    { name: "Kiran", amount: 600 },
  ],
};

describe("adding and editing entries", () => {
  it("saves an expense with its splits", async () => {
    const db = await testDb();
    await addEntry(db, dinner);
    const [saved] = await listEntries(db);
    expect(saved).toMatchObject({ amount: 1800, categorySlug: "dinner", origin: "manual", method: "upi" });
    expect(saved!.splits.map((share) => [share.name, share.amount, share.settledAt])).toEqual([
      ["Asha", 600, null],
      ["Kiran", 600, null],
    ]);
  });

  it("refuses shares bigger than the bill, and saves nothing", async () => {
    const db = await testDb();
    await expect(
      addEntry(db, { ...dinner, splits: [{ name: "Asha", amount: 2000 }] }),
    ).rejects.toThrow(/more than the bill/);
    expect(await listEntries(db)).toHaveLength(0);
  });

  it("says what is missing in plain words", async () => {
    const db = await testDb();
    await expect(addEntry(db, { ...dinner, amount: 0 })).rejects.toThrow("Add the amount in rupees.");
    await expect(addEntry(db, { ...dinner, description: " " })).rejects.toThrow(/what it was for/);
  });

  it("keeps 'paid back' when a split is edited but that share did not change", async () => {
    const db = await testDb();
    const id = await addEntry(db, dinner);
    await setShareSettled(db, id, "asha", true);
    await updateEntry(db, id, {
      ...dinner,
      amount: 2000,
      splits: [
        { name: "Asha", amount: 600 },
        { name: "Kiran", amount: 700 },
      ],
    });
    const [saved] = await listEntries(db);
    expect(saved!.splits.find((share) => share.name === "Asha")?.settledAt).not.toBeNull();
    expect(saved!.splits.find((share) => share.name === "Kiran")?.settledAt).toBeNull();
  });

  it("deletes an entry and its splits", async () => {
    const db = await testDb();
    const id = await addEntry(db, dinner);
    await deleteEntry(db, id);
    expect(await listEntries(db)).toHaveLength(0);
    expect(await db.getAllAsync("SELECT * FROM splits")).toHaveLength(0);
  });
});

describe("friends and split bills", () => {
  it("adds up what each friend owes across bills, and settles them", async () => {
    const db = await testDb();
    await addEntry(db, dinner);
    await addEntry(db, { ...dinner, date: "2026-10-22", amount: 900, splits: [{ name: "asha", amount: 300 }] });
    let balances = friendBalances(await listEntries(db));
    expect(balances.map((b) => [b.name, b.owed])).toEqual([
      ["Asha", 900],
      ["Kiran", 600],
    ]);
    await settleFriend(db, "ASHA");
    balances = friendBalances(await listEntries(db));
    expect(balances.find((b) => b.name === "Asha")).toMatchObject({ owed: 0, settled: 900 });
  });

  it("splits evenly with you absorbing the paise", () => {
    expect(evenShares(1000, ["Asha", "Kiran"])).toEqual([333.33, 333.33]);
  });
});

describe("categories and rules", () => {
  it("shows built-in categories as a tree", () => {
    const tree = categoryTree(BUILT_IN_CATEGORIES);
    const transport = tree.find((node) => node.parent.slug === "transport");
    expect(transport?.children.map((child) => child.slug)).toEqual(
      expect.arrayContaining(["rides", "petrol", "scooty-rental"]),
    );
    expect(tree.some((node) => node.parent.slug === "rides")).toBe(false);
    // Every category the backend knows is still here, so saved entries and the parser keep working.
    const slugs = new Set(BUILT_IN_CATEGORIES.map((category) => category.slug));
    expect(CATEGORY_SLUGS.filter((slug) => !slugs.has(slug))).toEqual([]);
    expect(slugs.size).toBe(BUILT_IN_CATEGORIES.length);
    // Every brand points at a category that exists.
    expect(PROVIDERS.filter((provider) => provider.categorySlug && !slugs.has(provider.categorySlug))).toEqual([]);
  });

  it("moves entries to Other when you delete a category you made", async () => {
    const db = await testDb();
    const slug = slugForLabel("Pet care", BUILT_IN_CATEGORIES);
    await addCustomCategory(db, { slug, label: "Pet care", parent: "household" });
    expect((await listCustomCategories(db))[0]).toMatchObject({ slug: "pet-care", parent: "household", custom: true });
    await addEntry(db, { ...dinner, splits: [], categorySlug: slug });
    await deleteCustomCategory(db, slug);
    expect((await listEntries(db))[0]?.categorySlug).toBe("other");
    expect(slugForLabel("Food", BUILT_IN_CATEGORIES)).toBe("food-2");
  });

  it("remembers a category for a shop, and the newest choice wins", async () => {
    const db = await testDb();
    const tx = { upiId: null, merchant: "Chai Point" };
    await saveRule(db, ruleFor(tx, { categorySlug: "food" })!);
    await saveRule(db, ruleFor(tx, { categorySlug: "outing" })!);
    const rules = await listRules(db);
    expect(rules).toHaveLength(1);
    const result = classify(
      { description: "Tea", merchant: "Chai Point", upiId: null, payee: null, amount: 120, type: "debit" },
      rules,
      BUILT_IN_CATEGORIES,
    );
    expect(result.categorySlug).toBe("outing");
  });
});

describe("your data", () => {
  it("adds and removes the sample month without touching your own entries", async () => {
    const db = await testDb();
    await addEntry(db, dinner);
    await addEntries(db, sampleEntries(new Date("2026-10-28T12:00:00+05:30")).entries);
    expect(await removeSamples(db)).toBe(22);
    expect(await listEntries(db)).toHaveLength(1);
  });

  it("backs up and restores everything", async () => {
    const db = await testDb();
    const id = await addEntry(db, dinner);
    await setShareSettled(db, id, "Kiran", true);
    await setSetting(db, "dailyLimit", 1500);
    await saveRule(db, ruleFor({ upiId: "swiggy@icici", merchant: "Swiggy" }, { categorySlug: "outing" })!);
    const text = JSON.stringify(await exportBackup(db));

    const other = await testDb();
    await addEntry(other, { ...dinner, description: "Will be replaced", splits: [] });
    await restoreBackup(other, parseBackup(text));
    const [restored] = await listEntries(other);
    expect(restored?.description).toBe("Dinner at Toit");
    expect(restored?.splits.find((share) => share.name === "Kiran")?.settledAt).not.toBeNull();
    expect(await getSetting(other, "dailyLimit", null)).toBe(1500);
    expect(await listRules(other)).toHaveLength(1);
  });

  it("refuses a file that is not a backup", () => {
    expect(() => parseBackup("{}")).toThrow(/not a Ledgerline backup/);
    expect(() => parseBackup("hello")).toThrow(/not a Ledgerline backup/);
  });

  it("erases everything", async () => {
    const db = await testDb();
    await addEntry(db, dinner);
    await setSetting(db, "dailyLimit", 1500);
    await eraseEverything(db);
    expect(await listEntries(db)).toHaveLength(0);
    expect(await getSetting(db, "dailyLimit", null)).toBeNull();
  });

  it("exports CSV with your share and stops spreadsheet formulas", async () => {
    const db = await testDb();
    await addEntry(db, { ...dinner, description: "=HYPERLINK(1)" });
    const csv = entriesCsv(await listEntries(db), BUILT_IN_CATEGORIES);
    const [header, row] = csv.trim().split("\n");
    expect(header).toMatch(/^Date,Type,Amount,Your share/);
    expect(row).toContain("1800.00,600.00");
    expect(row).toContain(`"'=HYPERLINK(1)"`);
    expect(row).toContain("Restaurants");
  });
});
