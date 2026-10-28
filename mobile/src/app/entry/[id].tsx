import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { EntryForm } from "@/features/EntryForm";
import { useLedger } from "@/state/ledger";
import { Button, Empty } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

export default function EditEntryScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, ready } = useLedger();
  const entry = entries.find((item) => item.id === id);
  if (entry) return <EntryForm key={entry.id} entry={entry} />;
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: space[5], justifyContent: "center" }}>
      <Empty
        title="This payment is gone"
        body="It was deleted, or your data was erased."
        action={<Button label="Back" variant="secondary" onPress={() => router.back()} />}
      />
    </View>
  );
}
