import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryLabel } from "@/core/catalog";
import { formatInrExact, formatShortDate } from "@/core/format";
import { linesFromTable, readCsvStatement, type ColumnMap, type CsvTable } from "@/core/csvStatement";
import { checkStatement, readStatement, statementText, type MissingLine, type ReadStatement, type StatementCheck } from "@/core/statement";
import { CategoryPicker } from "@/features/CategoryPicker";
import { ColumnPicker } from "@/features/ColumnPicker";
import { addEntries, clearIgnoredLines, ignoreLines, recordStatementCheck, listIgnoredLines } from "@/db/repo";
import { PdfPasswordError, usePdfReader } from "@/pdf/usePdfReader";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Divider, Empty, Field, Notice, Pill, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { MerchantAvatar } from "@/ui/CategoryVisual";
import { fonts, space, tabular, useTheme } from "@/ui/theme";
import { closeModal } from "@/features/navigation";

type Step =
  | { kind: "start" }
  | { kind: "reading"; name: string }
  | { kind: "password"; name: string; base64: string; wrong: boolean }
  | { kind: "columns"; name: string; table: CsvTable; map: ColumnMap | null }
  | { kind: "review"; check: StatementCheck }
  | { kind: "done"; added: number; left: number };

export default function StatementScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, entries, rules, categories, refresh } = useLedger();
  const { reader, read } = usePdfReader();
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryFor, setCategoryFor] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const analyse = async (name: string, base64: string, pdfPassword: string) => {
    setError(null);
    // The password is used for this one attempt only: the field is emptied
    // whether it opens the file or not, so it never lingers on screen.
    setPassword("");
    setStep({ kind: "reading", name });
    try {
      const pages = await read(base64, pdfPassword);
      await review(readStatement(statementText(pages)));
    } catch (caught) {
      if (caught instanceof PdfPasswordError) {
        setStep({ kind: "password", name, base64, wrong: caught.wrong });
        return;
      }
      setError(caught instanceof Error ? caught.message : "Ledgerline couldn't read this PDF.");
      setStep({ kind: "start" });
    }
  };

  /** PDF or CSV: the same check against what's on the phone. */
  const review = async (statement: ReadStatement) => {
    const check = checkStatement({
      statement,
      entries,
      ignored: await listIgnoredLines(db),
      rules,
      categories,
    });
    await recordStatementCheck(db, {
      bank: check.bank,
      dateFrom: check.from,
      dateTo: check.to,
      lineCount: check.lineCount,
      missingCount: check.missing.length,
    });
    await refresh();
    setSelected(new Set(check.missing.map((line) => line.key)));
    setCategoryFor({});
    setStep({ kind: "review", check });
  };

  const chooseCsv = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "text/comma-separated-values",
        "text/tab-separated-values",
        "text/plain",
        "application/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      let text: string;
      if (Platform.OS === "web") {
        text = asset.file ? await asset.file.text() : "";
      } else {
        const file = new File(asset.uri);
        try {
          text = await file.text();
        } finally {
          try {
            file.delete();
          } catch {
            // Already gone.
          }
        }
      }
      const { table, map } = readCsvStatement(text);
      if (map) {
        try {
          await review(linesFromTable(table, map, asset.name).statement);
          return;
        } catch {
          // Recognised headers but the rows didn't read: let the person pick.
        }
      }
      setStep({ kind: "columns", name: asset.name, table, map });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ledgerline couldn't read this file.");
      setStep({ kind: "start" });
    }
  };

  const choose = async () => {
    setError(null);
    setPassword("");
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    let base64: string;
    if (Platform.OS === "web") {
      // The browser hands the file over as a data URL.
      base64 = (asset.base64 ?? asset.uri).replace(/^data:[^,]*,/, "");
    } else {
      const file = new File(asset.uri);
      try {
        base64 = await file.base64();
      } finally {
        // The statement is read in memory; the copy the picker made is removed.
        try {
          file.delete();
        } catch {
          // Already gone.
        }
      }
    }
    await analyse(asset.name, base64, "");
  };

  const addSelected = async (check: StatementCheck) => {
    const chosen = check.missing.filter((line) => selected.has(line.key));
    setBusy(true);
    try {
      await addEntries(
        db,
        chosen.map((line) => ({
          date: line.date,
          amount: line.amount,
          type: line.type,
          description: line.description,
          merchant: line.merchant,
          upiId: line.upiId,
          providerId: line.providerId,
          categorySlug: categoryFor[line.key] ?? line.suggestedCategory,
          classificationSource: categoryFor[line.key] ? "user_override" : line.classificationSource,
          method: line.upiId ? "upi" : "other",
          origin: "statement",
          statementRef: line.key,
        })),
      );
      await refresh();
      setStep({ kind: "done", added: chosen.length, left: check.missing.length - chosen.length });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't add them. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const skip = async (check: StatementCheck, line: MissingLine) => {
    await ignoreLines(db, [line.key]);
    const missing = check.missing.filter((item) => item.key !== line.key);
    setSelected((set) => {
      const next = new Set(set);
      next.delete(line.key);
      return next;
    });
    setStep({ kind: "review", check: { ...check, missing, ignoredCount: check.ignoredCount + 1 } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {reader}
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={() => closeModal()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.topTitle, { color: c.foreground }]} accessibilityRole="header">
          Check a statement
        </Text>
        <View style={s.close} />
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space[6] }]} keyboardShouldPersistTaps="handled">
        {error ? <Notice tone="danger" title="Couldn't read that file." body={error} /> : null}

        {step.kind === "start" ? (
          <>
            <Card>
              <View style={[s.badge, { backgroundColor: c.primarySoft }]}>
                <Icon name="statement" size={26} color={c.primary} />
              </View>
              <CardTitle
                title="Upload your bank statement"
                sub="Ledgerline lists every payment in it that isn't in the app yet, and you add the ones you want in a tap."
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                <Pill tone="primary">PDF: HDFC, ICICI</Pill>
                <Pill tone="primary">CSV: any bank</Pill>
              </View>
              <View style={{ gap: space[2] }}>
                <Bullet icon="lock" text="Read on this phone. The file isn't uploaded or kept." />
                <Bullet icon="statement" text="The PDF or CSV from your net banking. Password-protected PDFs are fine." />
                <Bullet icon="check" text="Payments you already added are matched by amount and date, a day either way." />
              </View>
              <Button label="Choose statement PDF" icon="statement" onPress={choose} />
              <Button label="Choose a CSV export" variant="secondary" onPress={chooseCsv} />
              <T variant="small" tone="muted">
                {"SBI, Axis, Kotak or any other bank: download the statement as CSV (or XLS saved as CSV) from net banking."}
              </T>
            </Card>
            <IgnoredReset />
          </>
        ) : null}

        {step.kind === "reading" ? (
          <Card>
            <View style={s.reading} accessibilityLiveRegion="polite">
              <ActivityIndicator size="large" color={c.primary} />
              <T variant="title" style={{ textAlign: "center" }}>
                Reading your statement
              </T>
              <T variant="small" tone="muted" numberOfLines={1} style={{ textAlign: "center" }}>
                {step.name}
              </T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <Icon name="lock" size={14} color={c.success} />
                <T variant="small" tone="muted">
                  On this phone. Nothing is uploaded.
                </T>
              </View>
            </View>
          </Card>
        ) : null}

        {step.kind === "password" ? (
          <Card>
            <CardTitle
              title="This PDF has a password"
              sub="Banks lock statements. For HDFC it's usually your customer ID; for ICICI, check the email the statement came with. The password is used once and not saved."
            />
            <Field
              label="PDF password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              autoCapitalize="none"
              autoCorrect={false}
              error={step.wrong ? "That password didn't open it. Check it and try again." : null}
              onSubmitEditing={() => password && analyse(step.name, step.base64, password)}
            />
            <Button label="Open statement" disabled={!password} onPress={() => analyse(step.name, step.base64, password)} />
            <Button label="Choose a different file" variant="ghost" onPress={() => {
                setPassword("");
                setStep({ kind: "start" });
              }}
            />
          </Card>
        ) : null}

        {step.kind === "columns" ? (
          <ColumnPicker
            table={step.table}
            initial={step.map}
            fileName={step.name}
            onCancel={() => setStep({ kind: "start" })}
            onDone={(map) => {
              void (async () => {
                try {
                  await review(linesFromTable(step.table, map, step.name).statement);
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Couldn't read those columns.");
                }
              })();
            }}
          />
        ) : null}

        {step.kind === "review" ? (
          <>
            <Card>
              <CardTitle
                title={`${step.check.bank}`}
                sub={`${formatShortDate(step.check.from)} to ${formatShortDate(step.check.to)}`}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                <Pill>{`${step.check.lineCount} lines`}</Pill>
                <Pill tone="success">{`${step.check.matchedCount} already here`}</Pill>
                <Pill tone={step.check.missing.length ? "accent" : "success"}>{`${step.check.missing.length} missing`}</Pill>
                {step.check.ignoredCount ? <Pill>{`${step.check.ignoredCount} skipped before`}</Pill> : null}
              </View>
            </Card>

            {step.check.missing.length ? (
              <Card>
                <CardTitle
                  title="Missing from Ledgerline"
                  sub="Ticked ones are added. Tap a category to change it or skip the payment."
                />
                {step.check.missing.map((line, index) => {
                  const on = selected.has(line.key);
                  const slug = categoryFor[line.key] ?? line.suggestedCategory;
                  return (
                    <View key={line.key} style={{ gap: space[2] }}>
                      {index ? <Divider /> : null}
                      <View style={s.line}>
                        <Pressable
                          onPress={() =>
                            setSelected((set) => {
                              const next = new Set(set);
                              if (on) next.delete(line.key);
                              else next.add(line.key);
                              return next;
                            })
                          }
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`Add ${line.party ?? "payment"}, ${formatShortDate(line.date)}, ${line.type === "credit" ? "received" : "spent"} ${formatInrExact(line.amount)}`}
                          hitSlop={6}
                          style={[s.check, { borderColor: c.borderStrong, backgroundColor: on ? c.primary : "transparent" }]}>
                          {on ? <Icon name="check" size={14} color={c.primaryForeground} /> : null}
                        </Pressable>
                        <MerchantAvatar providerId={line.providerId} merchant={line.merchant ?? line.party} categorySlug={slug} size={36} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.lineTitle, { color: c.foreground }]} numberOfLines={1}>
                            {line.merchant ?? line.party ?? (line.type === "credit" ? "Money in" : "Payment")}
                          </Text>
                          <Pressable
                            onPress={() => setEditing(editing === line.key ? null : line.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`Category: ${categoryLabel(slug, categories)}. Change`}
                            accessibilityState={{ expanded: editing === line.key }}
                            hitSlop={8}
                            style={s.catButton}>
                            <Text style={[s.lineMeta, { color: c.muted }]} numberOfLines={1}>
                              {`${formatShortDate(line.date)} · `}
                              <Text style={{ color: c.primary, fontFamily: fonts.sansMedium }}>{categoryLabel(slug, categories)}</Text>
                            </Text>
                            <Icon name={editing === line.key ? "back" : "chevron"} size={11} color={c.primary} />
                          </Pressable>
                        </View>
                        <Text style={[s.lineAmount, { color: line.type === "credit" ? c.credit : c.foreground }]}>
                          {`${line.type === "credit" ? "+" : ""}${formatInrExact(line.amount)}`}
                        </Text>
                      </View>
                      {line.needsCheck ? (
                        <T variant="small" tone="muted">
                          {"The balance after this line didn't add up. Check it against the PDF before adding."}
                        </T>
                      ) : null}
                      {editing === line.key ? (
                        <View style={{ gap: space[3] }}>
                        <Text style={[s.lineMeta, { color: c.muted }]}>{line.description}</Text>
                        <CategoryPicker
                          categories={categories}
                          value={slug}
                          type={line.type}
                          onChange={(next) => setCategoryFor((map) => ({ ...map, [line.key]: next }))}
                        />
                        <Button label="Skip this payment" variant="ghost" onPress={() => skip(step.check, line)} accessibilityHint="Won't be listed again" />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                <Button
                  label={selected.size ? `Add ${selected.size} ${selected.size === 1 ? "payment" : "payments"}` : "Tick the ones to add"}
                  disabled={!selected.size}
                  busy={busy}
                  onPress={() => addSelected(step.check)}
                />
              </Card>
            ) : (
              <Card>
                <Empty title="Nothing is missing" body="Every payment in this statement is already in Ledgerline." />
                <Button label="Done" onPress={() => closeModal()} />
              </Card>
            )}
          </>
        ) : null}

        {step.kind === "done" ? (
          <Card>
            <View style={[s.badge, { backgroundColor: c.successSoft }]}>
              <Icon name="check" size={26} color={c.success} />
            </View>
            <CardTitle
              title={`Added ${step.added} ${step.added === 1 ? "payment" : "payments"}`}
              sub={
                step.left
                  ? `${step.left} you didn't tick will show again next time you check this statement, unless you skip them.`
                  : "Your month is complete for this statement."
              }
            />
            <Button label="Done" onPress={() => closeModal()} />
            <Button label="Check another statement" variant="secondary" onPress={() => setStep({ kind: "start" })} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Bullet({ icon, text }: { icon: "lock" | "statement" | "check"; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
      <Icon name={icon} size={18} color={c.primary} />
      <T style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

function IgnoredReset() {
  const { db } = useLedger();
  const [count, setCount] = useState<number | null>(null);
  if (count === null) {
    void listIgnoredLines(db).then((set) => setCount(set.size));
    return null;
  }
  if (!count) return null;
  return (
    <Card>
      <CardTitle title={`${count} skipped ${count === 1 ? "line" : "lines"}`} sub="Lines you skipped on earlier checks aren't listed again." />
      <Button
        label="List skipped lines again"
        variant="secondary"
        onPress={async () => {
          await clearIgnoredLines(db);
          setCount(0);
        }}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontFamily: fonts.display, fontSize: 18 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { padding: space[4], gap: space[4] },
  line: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2] },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  reading: { alignItems: "center", gap: space[3], paddingVertical: space[5] },
  check: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  catButton: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 24 },
  lineTitle: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20 },
  lineMeta: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 17 },
  lineAmount: { fontFamily: fonts.sansSemi, fontSize: 15, ...tabular },
});
