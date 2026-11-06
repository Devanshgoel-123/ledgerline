import { useLocalSearchParams } from "expo-router";
import type { TxType } from "@/core/model";
import { EntryForm } from "@/features/EntryForm";

/** The full form. Quick add's "More details" passes what was already typed. */
export default function AddScreen() {
  const params = useLocalSearchParams<{ amount?: string; category?: string; note?: string; type?: string }>();
  return (
    <EntryForm
      initial={{
        amount: params.amount || undefined,
        category: params.category || undefined,
        description: params.note || undefined,
        type: params.type === "credit" || params.type === "debit" ? (params.type as TxType) : undefined,
      }}
    />
  );
}
