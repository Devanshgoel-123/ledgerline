import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app.js";
import { signToken } from "../../src/auth/service.js";
import { resetStoreForTests } from "../../src/db/index.js";
import { MemoryStore } from "../../src/db/memory.js";
import { PostgresStore } from "../../src/db/postgres.js";
import type { Store } from "../../src/db/types.js";

/**
 * The API on a free port. Uses Postgres when TEST_DATABASE_URL is set
 * (`npm run test:db`), otherwise the in-memory store.
 */
export async function startTestApp(): Promise<{
  store: Store;
  base: string;
  close: () => Promise<void>;
  newUser: (label: string) => Promise<{ id: string; email: string; token: string }>;
  call: <T = unknown>(
    token: string,
    path: string,
    init?: { method?: string; body?: unknown },
  ) => Promise<{ status: number; body: T }>;
}> {
  const url = process.env.TEST_DATABASE_URL;
  const store: Store = url ? new PostgresStore(url) : new MemoryStore();
  await store.migrate();
  resetStoreForTests(store);
  const server: Server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    store,
    base,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (url) await store.close();
    },
    newUser: async (label) => {
      const user = await store.createUser({
        email: `${label}-${randomUUID().slice(0, 8)}@test.local`,
        passwordHash: "x",
        displayName: null,
      });
      return { id: user.id, email: user.email, token: signToken({ id: user.id, email: user.email }) };
    },
    call: async (token, path, init) => {
      const res = await fetch(`${base}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : null) as never };
    },
  };
}
