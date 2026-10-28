import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, View } from "react-native";
import { fromIsoDate, isoDate, today, yesterday } from "@/core/dates";
import { formatClock, formatDayLabel } from "@/core/format";
import { Chip } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

/** Today, Yesterday, or another day from the system date picker. */
export function DateChoice({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { dark } = useTheme();
  const [showIos, setShowIos] = useState(false);
  const t = today();
  const y = yesterday();
  const other = value !== t && value !== y;

  const pick = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: fromIsoDate(value),
        mode: "date",
        maximumDate: new Date(),
        onValueChange: (_event, date) => onChange(isoDate(date)),
      });
    } else {
      setShowIos((shown) => !shown);
    }
  };

  return (
    <View style={{ gap: space[2] }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Date" style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        <Chip label="Today" selected={value === t} onPress={() => onChange(t)} />
        <Chip label="Yesterday" selected={value === y} onPress={() => onChange(y)} />
        <Chip label={other ? formatDayLabel(value) : "Another day"} selected={other} onPress={pick} />
      </View>
      {showIos && Platform.OS === "ios" ? (
        <DateTimePicker
          value={fromIsoDate(value)}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          themeVariant={dark ? "dark" : "light"}
          onValueChange={(_event, date) => {
            onChange(isoDate(date));
            setShowIos(false);
          }}
        />
      ) : null}
    </View>
  );
}

/** A reminder time, as a chip that opens the system time picker. */
export function TimeChoice({
  hour,
  minute,
  onChange,
  label,
}: {
  hour: number;
  minute: number;
  onChange: (time: { hour: number; minute: number }) => void;
  label: string;
}) {
  const { dark } = useTheme();
  const [showIos, setShowIos] = useState(false);
  const value = new Date();
  value.setHours(hour, minute, 0, 0);

  const pick = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "time",
        onValueChange: (_event, date) => onChange({ hour: date.getHours(), minute: date.getMinutes() }),
      });
    } else {
      setShowIos((shown) => !shown);
    }
  };

  return (
    <View style={{ gap: space[2] }}>
      <Chip label={`${label} ${formatClock(hour, minute)}`} selected={false} onPress={pick} />
      {showIos && Platform.OS === "ios" ? (
        <DateTimePicker
          value={value}
          mode="time"
          display="spinner"
          themeVariant={dark ? "dark" : "light"}
          onValueChange={(_event, date) => onChange({ hour: date.getHours(), minute: date.getMinutes() })}
        />
      ) : null}
    </View>
  );
}
