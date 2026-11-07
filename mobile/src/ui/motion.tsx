import { useEffect, useRef, useState, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { motion } from "./theme";

const ease = Easing.bezier(...motion.bezier);

/** A number that runs from its last value to the new one, for figures that change. */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const begin = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (value - start) * eased;
      setShown(next);
      from.current = next;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

/**
 * A bar that grows to its size from zero, and glides to a new size when the
 * data changes. Vertical bars take a height in points, tracks a 0 to 1 width.
 */
export function Grow({
  to,
  axis = "y",
  delay = 0,
  style,
  children,
}: {
  to: number;
  axis?: "x" | "y";
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const size = useSharedValue(0);
  useEffect(() => {
    size.value = withDelay(delay, withTiming(Math.max(0, to), { duration: motion.enter + 140, easing: ease }));
  }, [to, delay, size]);
  const animated = useAnimatedStyle(() =>
    axis === "y" ? { height: size.value } : { width: `${Math.min(1, size.value) * 100}%` },
  );
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * The one entrance: a short fade and rise on first show, staggered by
 * `index` over the first six blocks. Animates opacity and transform only.
 */
export function Enter({ index = 0, children }: { index?: number; children?: ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(Math.min(index, 6) * motion.stagger, withTiming(1, { duration: motion.enter, easing: ease }));
  }, [index, progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}
