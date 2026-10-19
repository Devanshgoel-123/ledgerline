import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { config } from "../../src/config.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import {
  markTelegramError,
  markTelegramOk,
  resetTelegramHealthForTests,
  setTelegramMode,
  telegramBotHealth,
} from "../../src/telegram/health.js";
import {
  getTelegramStatus,
  handleTelegramUpdate,
  sendTelegramTest,
  telegramWebhookSecretMatches,
} from "../../src/telegram/service.js";

const CHAT_ID = "700001";
const savedTelegram = { ...config.telegram };
const realFetch = globalThis.fetch;

async function linkedUser() {
  const store = new MemoryStore();
  await store.migrate();
  const user = await store.createUser({
    email: "tg-health@example.com",
    passwordHash: "hash",
    displayName: "Tg",
  });
  await store.linkTelegramChat(user.id, CHAT_ID);
  resetStoreForTests(store);
  return user;
}

function telegramReplies(status: number, body: unknown) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input).replace(/bot[^/]+\//, "bot<token>/"));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  resetTelegramHealthForTests();
  Object.assign(config.telegram, {
    enabled: true,
    botToken: "123:test-token",
    botUsername: "ledgerline_test_bot",
    webhookSecret: "",
    webhookUrl: null,
  });
});

afterEach(() => {
  Object.assign(config.telegram, savedTelegram);
  globalThis.fetch = realFetch;
});

describe("telegram bot health", () => {
  it("is offline until a poll succeeds, and while polls fail", () => {
    setTelegramMode("polling");
    assert.equal(telegramBotHealth().online, false);
    markTelegramOk(1_000);
    assert.equal(telegramBotHealth(2_000).online, true);
    markTelegramError("Telegram rejected the bot token", 3_000);
    const failing = telegramBotHealth(4_000);
    assert.equal(failing.online, false);
    assert.equal(failing.lastError, "Telegram rejected the bot token");
    markTelegramOk(5_000);
    assert.deepEqual(
      { online: telegramBotHealth(6_000).online, lastError: telegramBotHealth(6_000).lastError },
      { online: true, lastError: null },
    );
  });

  it("goes offline when polls stop arriving", () => {
    setTelegramMode("polling");
    markTelegramOk(0);
    assert.equal(telegramBotHealth(60_000).online, true);
    assert.equal(telegramBotHealth(91_000).online, false);
  });

  it("is never online with the bot switched off", () => {
    setTelegramMode("off");
    markTelegramOk(0);
    assert.equal(telegramBotHealth(1).online, false);
  });
});

describe("telegram connection status", () => {
  it("does not say connected for a saved chat when the bot is not receiving", async () => {
    const user = await linkedUser();
    setTelegramMode("polling");
    const status = await getTelegramStatus(user.id);
    assert.equal(status.linked, true);
    assert.equal(status.connection, "bot_offline");
    assert.equal(status.bot.online, false);
    assert.ok(status.bot.problem);
  });

  it("says connected once the bot is polling", async () => {
    const user = await linkedUser();
    setTelegramMode("polling");
    markTelegramOk();
    const status = await getTelegramStatus(user.id);
    assert.equal(status.connection, "connected");
    assert.equal(status.bot.problem, null);
  });

  it("reports a blocked bot, and clears it when the user starts it again", async () => {
    const user = await linkedUser();
    setTelegramMode("polling");
    markTelegramOk();
    const chat = { id: Number(CHAT_ID), type: "private" };
    await handleTelegramUpdate({
      update_id: 1,
      my_chat_member: { chat, from: { id: 1 }, new_chat_member: { status: "kicked" } },
    });
    assert.equal((await getTelegramStatus(user.id)).connection, "chat_blocked");
    await handleTelegramUpdate({
      update_id: 2,
      my_chat_member: { chat, from: { id: 1 }, new_chat_member: { status: "member" } },
    });
    assert.equal((await getTelegramStatus(user.id)).connection, "connected");
  });

  it("reports an unlinked account and a server without a bot", async () => {
    const store = new MemoryStore();
    await store.migrate();
    const user = await store.createUser({ email: "nolink@example.com", passwordHash: "h", displayName: "N" });
    resetStoreForTests(store);
    assert.equal((await getTelegramStatus(user.id)).connection, "not_linked");
    config.telegram.enabled = false;
    assert.equal((await getTelegramStatus(user.id)).connection, "not_configured");
  });
});

describe("telegram test message", () => {
  it("marks the chat unreachable when Telegram refuses it", async () => {
    const user = await linkedUser();
    setTelegramMode("polling");
    markTelegramOk();
    const calls = telegramReplies(403, {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    });
    const result = await sendTelegramTest(user.id);
    assert.equal(result.sent, false);
    assert.equal(result.connection, "chat_blocked");
    assert.match(result.chatProblem ?? "", /blocked/);
    assert.deepEqual(calls, ["https://api.telegram.org/bot<token>/sendMessage"]);
  });

  it("confirms delivery and refuses rapid repeats", async () => {
    const user = await linkedUser();
    setTelegramMode("polling");
    markTelegramOk();
    telegramReplies(200, { ok: true, result: { message_id: 9 } });
    const result = await sendTelegramTest(user.id);
    assert.equal(result.sent, true);
    assert.equal(result.connection, "connected");
    await assert.rejects(sendTelegramTest(user.id), /Wait a few seconds/);
  });
});

describe("telegram webhook secret", () => {
  it("rejects every pushed update when the API is polling", () => {
    config.telegram.webhookSecret = "a-long-enough-secret";
    assert.equal(telegramWebhookSecretMatches("a-long-enough-secret"), false);
    config.telegram.webhookSecret = "";
    assert.equal(telegramWebhookSecretMatches(undefined), false);
    assert.equal(telegramWebhookSecretMatches(""), false);
  });

  it("accepts only the exact secret in webhook mode", () => {
    config.telegram.webhookUrl = "https://api.example.com/api/v1/telegram/webhook";
    config.telegram.webhookSecret = "a-long-enough-secret";
    assert.equal(telegramWebhookSecretMatches("a-long-enough-secret"), true);
    assert.equal(telegramWebhookSecretMatches("a-long-enough-secreT"), false);
    assert.equal(telegramWebhookSecretMatches("short"), false);
    assert.equal(telegramWebhookSecretMatches(undefined), false);
  });
});
