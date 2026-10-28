import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Hands a file to the system share sheet (save to Files, Drive, email to
 * yourself). The copy in the app's cache is removed afterwards.
 */
export async function shareFile(name: string, contents: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : "public.json" });
  } finally {
    try {
      file.delete();
    } catch {
      // Already gone.
    }
  }
}

/** Lets the user pick a backup file and returns its text, or null if they cancel. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const file = new File(result.assets[0].uri);
  try {
    return await file.text();
  } finally {
    try {
      file.delete();
    } catch {
      // Already gone.
    }
  }
}
