import { ImapFlow, type MessageStructureObject, type SearchObject } from "imapflow";
import { decryptSecret } from "../crypto/secrets.js";
import type { MailConnectionRow } from "../db/types.js";
import { AppError } from "../errors/AppError.js";
import { logger } from "../logger/index.js";
import {
  addIsoDays,
  clampPoolingAfter,
  fromAddressMatchesSenders,
  normalizeMailSenders,
  toIstCalendarDate,
} from "../helpers/index.js";
import { htmlToText } from "./htmlText.js";

/** One bank email found by a search, newest first. */
export type MailRef = {
  /** Stable id: the Message-ID header, or mailbox UIDVALIDITY + UID when there is none. */
  id: string;
  subject: string;
  fromAddress: string;
  receivedAt: string | null;
};

export type MailMessageDetails = MailRef & {
  bodyText: string;
};

export type MailSearch = {
  senders: readonly string[];
  /** Inclusive IST day. */
  after?: string;
  /** Exclusive IST day. */
  before?: string;
  /** "statement" asks only for mail whose subject mentions a statement. */
  kind: "alert" | "statement";
};

/**
 * A read-only view of one mailbox. Nothing here sets flags, moves, or deletes mail:
 * the folder is opened with EXAMINE and bodies are fetched with BODY.PEEK.
 */
export interface Mailbox {
  search(query: MailSearch): Promise<MailRef[]>;
  fetchDetails(id: string): Promise<MailMessageDetails>;
  fetchPdfs(id: string): Promise<Array<{ filename: string; buffer: Buffer }>>;
  close(): Promise<void>;
}

export type MailboxOpener = (connection: MailConnectionRow) => Promise<Mailbox>;

const CONNECT_TIMEOUT_MS = 20_000;
const SOCKET_TIMEOUT_MS = 60_000;
/** Headers are fetched in chunks so one search over years of mail stays bounded. */
const ENVELOPE_CHUNK = 200;
const MAX_ID_LENGTH = 400;
/** Statement PDFs are small; anything bigger is not one. */
const MAX_PDF_BYTES = 25 * 1024 * 1024;

type ImapAuth = { host: string; port: number; user: string; pass: string };

/**
 * An IMAP client. Its socket can fail long after the call that used it has
 * returned (a timeout a minute after a refused login), and an unheard "error"
 * event would crash the API, so every client gets a listener.
 */
export function newClient(auth: ImapAuth): ImapFlow {
  const client = new ImapFlow({
    host: auth.host,
    port: auth.port,
    secure: auth.port === 993,
    auth: { user: auth.user, pass: auth.pass },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    clientInfo: { name: "Ledgerline" },
  });
  client.on("error", (error: unknown) => {
    logger.warn({ err: error, host: auth.host }, "mail server connection error");
  });
  return client;
}

/** Plain-English reason an IMAP login failed, for the connect form. */
export function describeLoginError(error: unknown, host: string): string {
  const err = error as {
    code?: string;
    authenticationFailed?: boolean;
    responseText?: string;
    message?: string;
  };
  const text = `${err.responseText ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (/imap access is disabled|imap is disabled|enable imap/.test(text)) {
    return "This mailbox has IMAP turned off. Turn on IMAP in your mail settings, then try again.";
  }
  if (/application-specific password|app password|web login required/.test(text)) {
    return "This mailbox needs an app password, not your normal password. Create one using the steps above.";
  }
  if (err.authenticationFailed || /authenticationfailed|invalid credentials|authentication failed|login failed/.test(text)) {
    return "The email address or app password was not accepted. Check both and try again.";
  }
  if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
    return `Could not find the mail server ${host}. Check the server name and your internet connection.`;
  }
  if (
    err.code === "ECONNREFUSED" ||
    err.code === "ETIMEDOUT" ||
    err.code === "CONNECT_TIMEOUT" ||
    err.code === "GREETING_TIMEOUT"
  ) {
    return `Could not reach the mail server ${host}. Check the server, port, and your internet connection.`;
  }
  return "Could not sign in to this mailbox. Check the details and try again.";
}

/** Sign in once and sign out, so a wrong password is caught before anything is saved. */
export function verifyMailLogin(auth: ImapAuth): Promise<void> {
  return loginCheck(auth);
}

async function checkImapLogin(auth: ImapAuth): Promise<void> {
  const client = newClient(auth);
  try {
    await client.connect();
  } catch (error) {
    client.close();
    throw AppError.badRequest(describeLoginError(error, auth.host));
  }
  await client.logout().catch(() => client.close());
}

/** IMAP SINCE/BEFORE compare whole days in the server's zone: search a day wider, then filter in IST. */
export function imapSearchCriteria(query: MailSearch): SearchObject {
  const senders = normalizeMailSenders(query.senders);
  if (senders.length === 0) {
    throw new Error("No valid bank sender emails configured. Use a domain like hdfcbank.net.");
  }
  const after = clampPoolingAfter(query.after);
  const criteria: SearchObject = { since: new Date(`${addIsoDays(after, -1)}T00:00:00Z`) };
  if (query.before && query.before > after) {
    criteria.before = new Date(`${addIsoDays(query.before, 1)}T00:00:00Z`);
  }
  const from = senders.map((sender) => ({ from: sender }));
  if (from.length === 1) Object.assign(criteria, from[0]);
  else criteria.or = from;
  if (query.kind === "statement") criteria.subject = "statement";
  return criteria;
}

/** Keep only mail really from the bank and inside the IST window; newest first. */
export function filterMailRefs(refs: MailRef[], query: MailSearch): MailRef[] {
  const after = clampPoolingAfter(query.after);
  return refs
    .filter((ref) => fromAddressMatchesSenders(ref.fromAddress, query.senders))
    .filter((ref) => {
      const day = toIstCalendarDate(ref.receivedAt);
      if (!day) return false;
      if (day < after) return false;
      return !(query.before && day >= query.before);
    })
    .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
}

export function messageIdFor(input: {
  messageId?: string | null;
  uidValidity: bigint | number | string;
  uid: number;
}): string {
  const header = input.messageId?.trim().replace(/^<|>$/g, "");
  if (header && header.length <= MAX_ID_LENGTH) return header;
  return `uid:${String(input.uidValidity)}:${input.uid}`;
}

type Part = MessageStructureObject;

function walkParts(node: Part | undefined, out: Part[] = []): Part[] {
  if (!node) return out;
  if (node.childNodes?.length) {
    for (const child of node.childNodes) walkParts(child, out);
  } else {
    out.push(node);
  }
  return out;
}

function partFilename(part: Part): string | null {
  return part.dispositionParameters?.filename ?? part.parameters?.name ?? null;
}

function isPdfPart(part: Part): boolean {
  const name = partFilename(part) ?? "";
  return part.type.toLowerCase() === "application/pdf" || /\.pdf$/i.test(name);
}

function decodeText(content: Buffer | null, charset?: string): string {
  if (!content) return "";
  try {
    return new TextDecoder(charset || "utf-8").decode(content);
  } catch {
    return content.toString("utf8");
  }
}

function formatAddress(from: { name?: string; address?: string } | undefined): string {
  if (!from) return "";
  if (from.name && from.address) return `${from.name} <${from.address}>`;
  return from.address ?? from.name ?? "";
}

function isoDate(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Bank mail can sit anywhere; "All Mail" (Gmail and others) covers archived mail too. */
async function pickFolder(client: ImapFlow): Promise<string> {
  const folders = await client.list();
  return folders.find((folder) => folder.specialUse === "\\All")?.path ?? "INBOX";
}

class ImapMailbox implements Mailbox {
  private readonly uids = new Map<string, number>();
  private readonly refs = new Map<string, MailRef>();

  constructor(
    private readonly client: ImapFlow,
    private readonly uidValidity: bigint,
  ) {}

  async search(query: MailSearch): Promise<MailRef[]> {
    const found = await this.client.search(imapSearchCriteria(query), { uid: true });
    const uids = (found || []).sort((a, b) => b - a);
    const refs: MailRef[] = [];
    for (let i = 0; i < uids.length; i += ENVELOPE_CHUNK) {
      const chunk = uids.slice(i, i + ENVELOPE_CHUNK);
      const messages = await this.client.fetchAll(
        chunk,
        { uid: true, envelope: true, internalDate: true },
        { uid: true },
      );
      for (const message of messages) {
        const id = messageIdFor({
          messageId: message.envelope?.messageId,
          uidValidity: this.uidValidity,
          uid: message.uid,
        });
        const ref: MailRef = {
          id,
          subject: message.envelope?.subject ?? "",
          fromAddress: formatAddress(message.envelope?.from?.[0]),
          receivedAt: isoDate(message.internalDate) ?? isoDate(message.envelope?.date),
        };
        this.uids.set(id, message.uid);
        this.refs.set(id, ref);
        refs.push(ref);
      }
    }
    return filterMailRefs(refs, query);
  }

  /** The UID for an id from an earlier search, or found again by its Message-ID header. */
  private async uidFor(id: string): Promise<number> {
    const known = this.uids.get(id);
    if (known) return known;
    const byUid = /^uid:(\d+):(\d+)$/.exec(id);
    if (byUid) {
      if (BigInt(byUid[1]!) === this.uidValidity) return Number(byUid[2]);
    } else {
      const found = await this.client.search({ header: { "message-id": id } }, { uid: true });
      if (found && found.length > 0) return found[0]!;
    }
    throw AppError.notFound("That email is no longer in the mailbox. It may have been deleted.");
  }

  private async structure(uid: number) {
    const message = await this.client.fetchOne(
      String(uid),
      { uid: true, envelope: true, internalDate: true, bodyStructure: true },
      { uid: true },
    );
    if (!message) {
      throw AppError.notFound("That email is no longer in the mailbox. It may have been deleted.");
    }
    return message;
  }

  async fetchDetails(id: string): Promise<MailMessageDetails> {
    const uid = await this.uidFor(id);
    const message = await this.structure(uid);
    const parts = walkParts(message.bodyStructure).filter(
      (part) => part.part && /^text\/(plain|html)$/i.test(part.type) && !/attachment/i.test(part.disposition ?? ""),
    );
    let plain = "";
    let html = "";
    if (parts.length > 0) {
      const downloaded = await this.client.downloadMany(
        String(uid),
        parts.map((part) => part.part!),
        { uid: true },
      );
      for (const part of parts) {
        const item = downloaded[part.part!];
        const text = decodeText(item?.content ?? null, item?.meta.charset ?? part.parameters?.charset);
        if (/plain/i.test(part.type)) plain += `${text}\n`;
        else html += `${text}\n`;
      }
    }
    const known = this.refs.get(id);
    return {
      id,
      subject: known?.subject ?? message.envelope?.subject ?? "",
      fromAddress: known?.fromAddress ?? formatAddress(message.envelope?.from?.[0]),
      receivedAt: known?.receivedAt ?? isoDate(message.internalDate) ?? isoDate(message.envelope?.date),
      bodyText: plain.trim() ? plain.trim() : html.trim() ? htmlToText(html) : "",
    };
  }

  async fetchPdfs(id: string): Promise<Array<{ filename: string; buffer: Buffer }>> {
    const uid = await this.uidFor(id);
    const message = await this.structure(uid);
    const parts = walkParts(message.bodyStructure).filter(
      (part) => part.part && isPdfPart(part) && (part.size ?? 0) <= MAX_PDF_BYTES * 1.4,
    );
    if (parts.length === 0) return [];
    const downloaded = await this.client.downloadMany(
      String(uid),
      parts.map((part) => part.part!),
      { uid: true },
    );
    return parts.flatMap((part) => {
      const item = downloaded[part.part!];
      const content = item?.content;
      if (!content || content.length > MAX_PDF_BYTES) return [];
      return [{ filename: item.meta.filename || partFilename(part) || "statement.pdf", buffer: content }];
    });
  }

  async close(): Promise<void> {
    await this.client.logout().catch(() => this.client.close());
  }
}

const openImapMailbox: MailboxOpener = async (connection) => {
  if (!connection.passwordEncrypted) {
    throw AppError.badRequest("Enter your mailbox app password again to keep scanning bank mail.");
  }
  const client = newClient({
    host: connection.host,
    port: connection.port,
    user: connection.email,
    pass: decryptSecret(connection.passwordEncrypted),
  });
  try {
    await client.connect();
  } catch (error) {
    client.close();
    throw new Error(describeLoginError(error, connection.host));
  }
  try {
    const folder = await pickFolder(client);
    const opened = await client.mailboxOpen(folder, { readOnly: true });
    return new ImapMailbox(client, opened.uidValidity);
  } catch (error) {
    await client.logout().catch(() => client.close());
    throw error;
  }
};

let opener: MailboxOpener = openImapMailbox;
let loginCheck: (auth: ImapAuth) => Promise<void> = checkImapLogin;

export function openMailbox(connection: MailConnectionRow): Promise<Mailbox> {
  return opener(connection);
}

/** Tests replace the mail server with an in-memory mailbox. Call with nothing to restore IMAP. */
export function setMailServerForTests(fake?: {
  open?: MailboxOpener;
  verify?: (auth: ImapAuth) => Promise<void>;
}): void {
  opener = fake?.open ?? openImapMailbox;
  loginCheck = fake?.verify ?? checkImapLogin;
}
