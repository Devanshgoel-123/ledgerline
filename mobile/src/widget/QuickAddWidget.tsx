import { Circle, HStack, Link, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { background, clipShape, containerBackground, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

/**
 * The home-screen widget: today's and this month's spend, and a tap into
 * Quick add. The medium size adds four category shortcuts.
 *
 * Widget code runs in the widget extension, not the app: it can't use hooks,
 * imports at runtime, or anything declared outside this function. Every value
 * it shows comes in as props from `syncWidget` (./sync.ts). Colours are
 * written inline for the same reason (they match theme.ts heroFrom/heroTo).
 */
export type QuickAddWidgetProps = {
  today: string;
  month: string;
  empty: boolean;
  shortcuts: { slug: string; label: string; color: string }[];
};

const QuickAddWidget = (props: QuickAddWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const medium = environment.widgetFamily === "systemMedium";
  const summary = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle("#C6D6E3")]}>Today</Text>
      <Text modifiers={[font({ size: 28, weight: "bold" }), monospacedDigit(), foregroundStyle("#FFFFFF"), lineLimit(1)]}>
        {props.today}
      </Text>
      <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle("#C6D6E3"), lineLimit(1)]}>
        {props.empty ? "Tap to add your first" : `${props.month} this month`}
      </Text>
      <Spacer />
      <Link destination="ledgerline://quick">
        <HStack spacing={4} modifiers={[padding({ horizontal: 12, vertical: 7 }), background("#FFFFFF"), clipShape("capsule")]}>
          <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle("#102A43")]}>+ Add</Text>
        </HStack>
      </Link>
    </VStack>
  );

  return (
    <HStack
      spacing={12}
      modifiers={[
        containerBackground(
          { type: "linearGradient", colors: ["#102A43", "#1D5A73"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
          "widget",
        ),
        widgetURL("ledgerline://quick"),
      ]}>
      {summary}
      {medium ? <Spacer /> : null}
      {medium ? (
        <VStack spacing={6} modifiers={[frame({ maxWidth: 150 })]}>
          {props.shortcuts.map((shortcut) => (
            <Link key={shortcut.slug} destination={`ledgerline://quick?category=${shortcut.slug}`}>
              <HStack
                spacing={8}
                modifiers={[
                  padding({ horizontal: 10, vertical: 6 }),
                  frame({ maxWidth: 150, alignment: "leading" }),
                  background("#FFFFFF24"),
                  clipShape("roundedRectangle", 10),
                ]}>
                <Circle modifiers={[foregroundStyle(shortcut.color), frame({ width: 10, height: 10 })]} />
                <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle("#FFFFFF"), lineLimit(1)]}>{shortcut.label}</Text>
                <Spacer />
              </HStack>
            </Link>
          ))}
        </VStack>
      ) : null}
    </HStack>
  );
};

export default createWidget("QuickAdd", QuickAddWidget, {
  today: "₹0",
  month: "₹0",
  empty: true,
  shortcuts: [],
});
