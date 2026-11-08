import { Capsule, HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { activityBackgroundTint, background, clipShape, font, foregroundStyle, lineLimit, monospacedDigit, padding, tint } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";
import type { TodayActivityProps } from "@/core/today";

/**
 * "Today" on the Lock Screen and in the Dynamic Island: what you've spent
 * today, how many payments, what's left of your daily limit, and how many
 * payments still need a category. Started and updated by the app
 * (./today.ts); the iOS payment popup updates it too, so it stays current
 * without opening Ledgerline.
 *
 * Like the home-screen widget, this runs in the widget extension: no hooks,
 * no imports at runtime, colours inline (theme.ts heroFrom and the brand blue).
 */
const TodayActivity = (props: TodayActivityProps, environment: LiveActivityEnvironment) => {
  "widget";
  const dim = environment.isLuminanceReduced === true;
  const warn = "#F5A524";
  const muted = "#C6D6E3";
  const sortPill =
    props.toSort === "" ? null : (
      <HStack spacing={4} modifiers={[padding({ horizontal: 8, vertical: 4 }), background("#FFFFFF24"), clipShape("capsule")]}>
        <Image systemName="tag" size={11} color={warn} />
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle("#FFFFFF")]}>{props.toSort}</Text>
      </HStack>
    );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), activityBackgroundTint("#102A43")]}>
        <HStack spacing={8}>
          <Image systemName="indianrupeesign.circle.fill" size={16} color="#7FB8E6" />
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(muted)]}>Today</Text>
          <Spacer />
          {sortPill}
        </HStack>
        <HStack alignment="lastTextBaseline" spacing={8}>
          <Text modifiers={[font({ size: 34, weight: "bold" }), monospacedDigit(), foregroundStyle(props.over ? warn : "#FFFFFF"), lineLimit(1)]}>
            {props.spent}
          </Text>
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.detail}</Text>
        </HStack>
        {props.progress >= 0 && !dim ? (
          <ProgressView value={props.progress} modifiers={[tint(props.over ? warn : "#7FB8E6")]} />
        ) : null}
        {props.last === "" ? null : (
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.last}</Text>
        )}
      </VStack>
    ),
    compactLeading: <Image systemName="indianrupeesign.circle.fill" size={14} color="#7FB8E6" />,
    compactTrailing: (
      <Text modifiers={[font({ size: 14, weight: "semibold" }), monospacedDigit(), foregroundStyle(props.over ? warn : "#FFFFFF")]}>
        {props.spent}
      </Text>
    ),
    minimal: <Image systemName="indianrupeesign.circle.fill" size={14} color={props.over ? warn : "#7FB8E6"} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(muted)]}>Today</Text>
        <Text modifiers={[font({ size: 24, weight: "bold" }), monospacedDigit(), foregroundStyle(props.over ? warn : "#FFFFFF"), lineLimit(1)]}>
          {props.spent}
        </Text>
      </VStack>
    ),
    expandedTrailing: sortPill ?? <Capsule modifiers={[foregroundStyle("#00000000")]} />,
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4 })]}>
        <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.detail}</Text>
        {props.progress >= 0 ? <ProgressView value={props.progress} modifiers={[tint(props.over ? warn : "#7FB8E6")]} /> : null}
        {props.last === "" ? null : (
          <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}>{props.last}</Text>
        )}
      </VStack>
    ),
  };
};

export default createLiveActivity("TodayStats", TodayActivity);
