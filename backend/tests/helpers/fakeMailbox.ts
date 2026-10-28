import { filterMailRefs, type Mailbox, type MailRef, type MailSearch } from "../../src/bankMail/mailbox.js";

export type FakeMessage = MailRef & {
  bodyText?: string;
  pdfs?: Array<{ filename: string; buffer: Buffer }>;
};

/**
 * An in-memory mailbox with the same read-only surface as the IMAP one. It records
 * what was asked of it so tests can check a scan never reads mail it should not.
 */
export function fakeMailbox(messages: FakeMessage[]): Mailbox & {
  searches: MailSearch[];
  fetched: string[];
  closed: number;
} {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const box = {
    searches: [] as MailSearch[],
    fetched: [] as string[],
    closed: 0,
    async search(query: MailSearch) {
      box.searches.push(query);
      const candidates =
        query.kind === "statement"
          ? messages.filter((message) => /statement/i.test(message.subject))
          : messages;
      return filterMailRefs(
        candidates.map(({ id, subject, fromAddress, receivedAt }) => ({ id, subject, fromAddress, receivedAt })),
        query,
      );
    },
    async fetchDetails(id: string) {
      box.fetched.push(id);
      const message = byId.get(id);
      if (!message) throw new Error(`no message ${id}`);
      return {
        id,
        subject: message.subject,
        fromAddress: message.fromAddress,
        receivedAt: message.receivedAt,
        bodyText: message.bodyText ?? "",
      };
    },
    async fetchPdfs(id: string) {
      box.fetched.push(id);
      return byId.get(id)?.pdfs ?? [];
    },
    async close() {
      box.closed += 1;
    },
  };
  return box;
}
