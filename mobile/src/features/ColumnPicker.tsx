import { useState } from "react";
import { View } from "react-native";
import { linesFromTable, mapIsUsable, type ColumnMap, type ColumnRole, type CsvTable } from "@/core/csvStatement";
import { formatInrExact, formatShortDate } from "@/core/format";
import { Button, Card, CardTitle, Chip, Divider, Segmented, T } from "@/ui/components";
import { space } from "@/ui/theme";

const ROLE_LABEL: Record<ColumnRole, { title: string; hint: string }> = {
  date: { title: "Date", hint: "The day of the payment" },
  description: { title: "Description", hint: "Narration, particulars or remarks" },
  debit: { title: "Money out", hint: "Withdrawals or debits" },
  credit: { title: "Money in", hint: "Deposits or credits" },
  amount: { title: "Amount", hint: "One column for every payment" },
  direction: { title: "Dr / Cr", hint: "Says whether money went out or came in (optional)" },
  balance: { title: "Balance", hint: "" },
};

/**
 * For a CSV whose headers Ledgerline doesn't recognise: tap which column is
 * which. A preview of the first payments shows straight away whether the
 * choice reads right.
 */
export function ColumnPicker({
  table,
  initial,
  fileName,
  onDone,
  onCancel,
}: {
  table: CsvTable;
  initial: ColumnMap | null;
  fileName: string;
  onDone: (map: ColumnMap) => void;
  onCancel: () => void;
}) {
  const [map, setMap] = useState<ColumnMap>(initial ?? {});
  const [shape, setShape] = useState<"split" | "single">(initial?.amount !== undefined && initial.debit === undefined ? "single" : "split");
  const roles: ColumnRole[] = ["date", "description", ...(shape === "split" ? (["debit", "credit"] as const) : (["amount", "direction"] as const))];
  const headers = table.headers.map((header, index) => header.trim() || `Column ${index + 1}`);

  const effective: ColumnMap =
    shape === "split"
      ? { date: map.date, description: map.description, debit: map.debit, credit: map.credit, balance: map.balance }
      : { date: map.date, description: map.description, amount: map.amount, direction: map.direction, balance: map.balance };

  let preview: { lines: { date: string; text: string; amount: string }[]; error: string | null } = { lines: [], error: null };
  if (mapIsUsable(effective)) {
    try {
      const { statement } = linesFromTable(table, effective, fileName);
      preview = {
        lines: statement.lines.slice(0, 3).map((line) => ({
          date: formatShortDate(line.date),
          text: line.description,
          amount: `${line.type === "credit" ? "+" : "−"}${formatInrExact(line.amount)}`,
        })),
        error: null,
      };
    } catch (caught) {
      preview = { lines: [], error: caught instanceof Error ? caught.message : "These columns don't read as payments." };
    }
  }

  return (
    <Card>
      <CardTitle title="Which column is which?" sub="Your bank names its columns in its own way. Tap the right one for each." />
      <Segmented
        label="How the file shows amounts"
        value={shape}
        onChange={setShape}
        options={[
          { value: "split", label: "Out and in columns" },
          { value: "single", label: "One amount column" },
        ]}
      />
      {roles.map((role, index) => (
        <View key={role} style={{ gap: space[2] }}>
          {index ? <Divider /> : null}
          <View>
            <T variant="strong">{ROLE_LABEL[role].title}</T>
            <T variant="small" tone="muted">
              {ROLE_LABEL[role].hint}
            </T>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={ROLE_LABEL[role].title} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {headers.map((header, column) => (
              <Chip
                key={column}
                label={header}
                selected={map[role] === column}
                onPress={() => setMap((current) => ({ ...current, [role]: current[role] === column ? undefined : column }))}
              />
            ))}
          </View>
        </View>
      ))}

      {preview.lines.length ? (
        <View style={{ gap: space[1] }}>
          <T variant="strong">First payments</T>
          {preview.lines.map((line, index) => (
            <T key={index} variant="small" tone="muted" numberOfLines={1}>
              {`${line.date} · ${line.amount} · ${line.text}`}
            </T>
          ))}
        </View>
      ) : preview.error ? (
        <T variant="small" tone="danger">
          {preview.error}
        </T>
      ) : null}

      <Button label="Check these payments" disabled={!preview.lines.length} onPress={() => onDone(effective)} />
      <Button label="Choose a different file" variant="ghost" onPress={onCancel} />
    </Card>
  );
}
