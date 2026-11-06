import { router } from "expo-router";
import { View } from "react-native";
import { categoryTree, rootCategory, type Category } from "@/core/catalog";
import { Button, Chip, T } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

/** Main categories as chips; the chosen one's sub-categories appear below it. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  type,
}: {
  categories: Category[];
  value: string | null;
  onChange: (slug: string) => void;
  type: "debit" | "credit";
}) {
  const { categoryColor } = useTheme();
  const tree = categoryTree(categories).filter((node) =>
    // Money in rarely goes to Food or Shopping; keep its list short.
    type === "credit"
      ? ["family", "personal", "investments", "banks", "other"].includes(node.parent.slug) || node.parent.custom
      : node.parent.slug !== "banks",
  );
  const root = value ? rootCategory(value, categories) : null;
  const children = tree.find((node) => node.parent.slug === root)?.children ?? [];
  const visibleChildren = type === "credit" ? children.filter((child) => ["salary", "from-home", "self-transfer"].includes(child.slug) || child.custom) : children;

  return (
    <View style={{ gap: space[3] }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Category" style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {tree.map(({ parent }) => (
          <Chip
            key={parent.slug}
            label={parent.label}
            color={categoryColor(parent.slug)}
            selected={root === parent.slug}
            onPress={() => onChange(parent.slug)}
          />
        ))}
      </View>
      {root && visibleChildren.length ? (
        <View style={{ gap: space[2] }}>
          <T variant="small" tone="muted">
            More exact (optional)
          </T>
          <View accessibilityRole="radiogroup" accessibilityLabel="Sub-category" style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {visibleChildren.map((child) => (
              <Chip
                key={child.slug}
                label={child.label}
                color={categoryColor(child.slug)}
                selected={value === child.slug}
                onPress={() => onChange(value === child.slug ? root : child.slug)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Button label="Make your own category" variant="ghost" icon="add" onPress={() => router.push("/categories")} />
    </View>
  );
}
