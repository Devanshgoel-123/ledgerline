import { describe, expect, it } from "vitest";
import { telegramConnectHint, telegramPill } from "@/lib/telegram";

describe("telegramConnectHint", () => {
  it("explains when the bot is not configured", () => {
    expect(
      telegramConnectHint({
        configured: false,
        linked: false,
        botUsername: null,
      }),
    ).toMatch(/not enabled/i);
  });

  it("confirms a linked chat", () => {
    expect(
      telegramConnectHint({
        configured: true,
        linked: true,
        botUsername: "ledgerline_bot",
        phone: "+91 •••• 3210",
      }),
    ).toMatch(/Linked to \+91/);
  });

  it("tells an unlinked account to share the number with the bot", () => {
    expect(
      telegramConnectHint({
        configured: true,
        linked: false,
        botUsername: "ledgerline_bot",
        verify: {
          phone: "+91 •••• 3210",
          codeSent: false,
          expiresAt: null,
          botUrl: "https://t.me/ledgerline_bot?start=verify",
        },
      }),
    ).toMatch(/Share my number/);
  });
});

describe("telegramPill", () => {
  const linked = { configured: true, linked: true, botUsername: "ledgerline_bot" };

  it("says connected only when the server confirms the bot and chat work", () => {
    expect(telegramPill({ ...linked, connection: "connected" })).toEqual({
      label: "Connected",
      tone: "on",
    });
    expect(telegramPill({ ...linked, connection: "bot_offline" })).toEqual({
      label: "Bot offline",
      tone: "warn",
    });
    expect(telegramPill({ ...linked, connection: "chat_blocked" })).toEqual({
      label: "Not reachable",
      tone: "warn",
    });
  });

  it("shows not linked without a saved chat", () => {
    expect(telegramPill(null).label).toBe("Not linked");
    expect(telegramPill({ ...linked, linked: false, connection: "not_linked" }).label).toBe(
      "Not linked",
    );
  });

  it("explains why a linked bot will not answer", () => {
    expect(
      telegramConnectHint({
        ...linked,
        connection: "bot_offline",
        bot: { mode: "polling", online: false, problem: "Telegram rejected the bot token" },
      }),
    ).toMatch(/not receiving messages.*rejected the bot token/);
    expect(
      telegramConnectHint({
        ...linked,
        connection: "chat_blocked",
        chatProblem: "Forbidden: bot was blocked by the user",
      }),
    ).toMatch(/blocked by the user/);
  });
});
