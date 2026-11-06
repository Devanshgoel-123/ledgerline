import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { categoryTree, fitsType, rootCategory, type Category } from "@/core/catalog";
import { CategoryTile } from "@/ui/CategoryVisual";
import { Icon } from "@/ui/Icon";
import { fonts, space, useTheme } from "@/ui/theme";

/**
 * Top-level categories as an icon grid; the chosen one's sub-categories
 * appear in a row under it. Only categories that fit money out or money in
 * are offered.
 */
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
  const { c } = useTheme();
  const tree = categoryTree(categories).filter((node) => fitsType(node.parent.slug, type, categories));
  const root = value ? rootCategory(value, categories) : null;
  const children = (tree.find((node) => node.parent.slug === root)?.children ?? []).filter((child) =>
    fitsType(child.slug, type, categories),
  );

  return (
    <View style={{ gap: space[3] }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Category" style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[2] }}>
        {tree.map(({ parent }) => (
          <CategoryTile
            key={parent.slug}
            slug={parent.slug}
            label={parent.label}
            width="25%"
            selected={root === parent.slug}
            onPress={() => onChange(parent.slug)}
          />
        ))}
      </View>
      {root && children.length ? (
        <View style={{ gap: space[2] }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: c.muted }}>More exact (optional)</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Sub-category" style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[2] }}>
            {children.map((child) => (
              <CategoryTile
                key={child.slug}
                slug={child.slug}
                label={child.label}
                width="25%"
                selected={value === child.slug}
                onPress={() => onChange(value === child.slug ? root : child.slug)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Pressable
        onPress={() => router.push("/categories")}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, opacity: pressed ? 0.6 : 1 })}>
        <Icon name="add" size={16} color={c.primary} />
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: c.primary }}>New category</Text>
      </Pressable>
    </View>
  );
}
