import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const INSECURE_JWT_DEFAULTS = new Set([
  "dev-only-jwt-secret-change-me",
  "change-me-to-a-long-random-string",
  "test-jwt-secret",
]);

const INSECURE_ENCRYPTION_DEFAULTS = new Set([
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
]);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  LOG_PRETTY: z.enum(["0", "1"]).default("1"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  /** Host names the API answers to. There is no sign-in, so keep this to this computer. */
  LEDGERLINE_ALLOWED_HOSTS: z.string().default("localhost,127.0.0.1,[::1]"),
  DATABASE_URL: z.string().min(1).default("memory"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    ),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default("http://localhost:4000/api/v1/auth/google/callback"),
  GMAIL_PUBSUB_TOPIC: z.string().optional().default(""),
  /** Audience set on the Pub/Sub push subscription's OIDC token (usually the push URL). */
  GMAIL_PUSH_AUDIENCE: z.string().optional().default(""),
  /** Service account the push subscription signs its token as. */
  GMAIL_PUSH_SERVICE_ACCOUNT: z.string().optional().default(""),
  DISABLE_INLINE_GMAIL_JOBS: z.enum(["0", "1"]).default("0"),
  POOLING_WORKER_SEPARATE: z.enum(["0", "1"]).default("0"),
  POOLING_WORKER_HOST: z.string().min(1).default("127.0.0.1"),
  /** Bearer token for the worker's /status, /run, /probe and /backfill. Empty: loopback callers only. */
  POOLING_WORKER_TOKEN: z.string().optional().default(""),
  POOLING_WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(5473),
  POOLING_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(6 * 60 * 60 * 1000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(15),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_POOL_IDLE_MS: z.coerce.number().int().positive().default(30_000),
  DB_POOL_CONN_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  /**
   * Proxy hops in front of the API whose X-Forwarded-For is trusted. 0 (default): the API
   * faces clients directly and the header is ignored, so it cannot dodge rate limits.
   */
  TRUST_PROXY: z.string().optional().default("0"),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),
  /** Public https base URL Telegram can reach (an API domain or an ngrok URL). Empty: long-poll instead. */
  TELEGRAM_WEBHOOK_URL: z.string().optional().default(""),
});

export type AppConfig = {
  env: "development" | "test" | "production";
  isProduction: boolean;
  isTest: boolean;
  port: number;
  logLevel: z.infer<typeof envSchema>["LOG_LEVEL"];
  logPretty: boolean;
  corsOrigins: string[];
  local: {
    /** Lower-case host names (no port) that the API answers to. */
    allowedHosts: string[];
  };
  databaseUrl: string;
  databaseHost: string;
  useMemoryStore: boolean;
  jwtSecret: string;
  encryptionKey: string;
  frontendUrl: string;
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    pubsubTopic: string;
    pushAudience: string;
    pushServiceAccount: string;
    inlineJobsEnabled: boolean;
  };
  poolingWorker: {
    separateProcess: boolean;
    host: string;
    /** Empty: control routes answer loopback callers only. */
    token: string;
    port: number;
    intervalMs: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    uploadMax: number;
  };
  dbPool: {
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  /** Express "trust proxy": false, a hop count, or an address/CIDR list. */
  trustProxy: boolean | number | string;
  telegram: {
    enabled: boolean;
    botToken: string;
    botUsername: string;
    webhookSecret: string;
    /** Full webhook URL when Telegram pushes to us; null means this API long-polls. */
    webhookUrl: string | null;
  };
};

function parseTrustProxy(raw: string): boolean | number | string {
  const value = raw.trim().toLowerCase();
  if (value === "" || value === "0" || value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true") {
    throw new Error("TRUST_PROXY=true trusts any X-Forwarded-For. Set the number of proxy hops instead.");
  }
  return raw.trim();
}

/** `https://host[/base]` -> the API's webhook route, or null when unset. */
function telegramWebhookTarget(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TELEGRAM_WEBHOOK_URL must be a full https:// URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("TELEGRAM_WEBHOOK_URL must use https; Telegram only calls https webhooks");
  }
  return value.endsWith("/api/v1/telegram/webhook") ? value : `${value}/api/v1/telegram/webhook`;
}

function databaseHost(url: string): string {
  if (url === "memory") return "memory";
  try {
    return new URL(url).hostname;
  } catch {
    return "postgres";
  }
}

function resolveJwtSecret(raw: string | undefined, nodeEnv: string): string {
  if (raw && raw.length >= 16) return raw;
  if (nodeEnv === "production") {
    throw new Error("JWT_SECRET is required in production (min 16 chars)");
  }
  return raw && raw.length >= 16 ? raw : "dev-only-jwt-secret-change-me";
}

function resolveEncryptionKey(
  raw: string | undefined,
  nodeEnv: string,
): string {
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) return raw;
  if (nodeEnv === "production") {
    throw new Error(
      "ENCRYPTION_KEY is required in production (64 hex characters)",
    );
  }
  return (
    raw && /^[0-9a-fA-F]{64}$/.test(raw)
      ? raw
      : "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  );
}

function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  const parsed = envSchema.safeParse({
    ...process.env,
    JWT_SECRET: resolveJwtSecret(process.env.JWT_SECRET, nodeEnv),
    ENCRYPTION_KEY: resolveEncryptionKey(process.env.ENCRYPTION_KEY, nodeEnv),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${details}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    if (INSECURE_JWT_DEFAULTS.has(env.JWT_SECRET)) {
      throw new Error(
        "JWT_SECRET uses an insecure default. Set a strong secret before production.",
      );
    }
    if (INSECURE_ENCRYPTION_DEFAULTS.has(env.ENCRYPTION_KEY.toLowerCase())) {
      throw new Error(
        "ENCRYPTION_KEY uses an insecure default. Set a unique 32-byte key before production.",
      );
    }
    if (env.DATABASE_URL === "memory") {
      throw new Error(
        "DATABASE_URL=memory is not allowed in production. Use PostgreSQL.",
      );
    }
    if (env.GMAIL_PUBSUB_TOPIC && (!env.GMAIL_PUSH_AUDIENCE || !env.GMAIL_PUSH_SERVICE_ACCOUNT)) {
      throw new Error(
        "GMAIL_PUBSUB_TOPIC needs GMAIL_PUSH_AUDIENCE and GMAIL_PUSH_SERVICE_ACCOUNT so push requests can be verified.",
      );
    }
    if (!env.DATABASE_URL.startsWith("postgres")) {
      throw new Error(
        "DATABASE_URL must be a postgres:// or postgresql:// URL in production.",
      );
    }
  }

  const telegramWebhookUrl = telegramWebhookTarget(env.TELEGRAM_WEBHOOK_URL);
  if (telegramWebhookUrl && env.TELEGRAM_WEBHOOK_SECRET.trim().length < 16) {
    throw new Error(
      "TELEGRAM_WEBHOOK_URL needs TELEGRAM_WEBHOOK_SECRET (16+ characters) so webhook calls can be verified.",
    );
  }

  const corsOrigins = env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must include at least one origin");
  }

  if (env.NODE_ENV === "production" && corsOrigins.includes("*")) {
    throw new Error("CORS_ORIGINS=* is not allowed in production");
  }

  // JSON logs only in production/test containers — pretty transport is a crash risk without pino-pretty.
  const logPretty =
    env.NODE_ENV === "development" && env.LOG_PRETTY === "1";

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    logPretty,
    corsOrigins,
    local: {
      allowedHosts: env.LEDGERLINE_ALLOWED_HOSTS.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    },
    databaseUrl: env.DATABASE_URL,
    databaseHost: databaseHost(env.DATABASE_URL),
    useMemoryStore: env.DATABASE_URL === "memory",
    jwtSecret: env.JWT_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
    frontendUrl: env.FRONTEND_URL,
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      pubsubTopic: env.GMAIL_PUBSUB_TOPIC,
      pushAudience: env.GMAIL_PUSH_AUDIENCE,
      pushServiceAccount: env.GMAIL_PUSH_SERVICE_ACCOUNT.trim().toLowerCase(),
      inlineJobsEnabled:
        env.DISABLE_INLINE_GMAIL_JOBS !== "1" &&
        env.POOLING_WORKER_SEPARATE !== "1",
    },
    poolingWorker: {
      separateProcess: env.POOLING_WORKER_SEPARATE === "1",
      host: env.POOLING_WORKER_HOST,
      token: env.POOLING_WORKER_TOKEN.trim(),
      port: env.POOLING_WORKER_PORT,
      intervalMs: env.POOLING_WORKER_INTERVAL_MS,
    },
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      uploadMax: env.RATE_LIMIT_UPLOAD_MAX,
    },
    dbPool: {
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_POOL_IDLE_MS,
      connectionTimeoutMillis: env.DB_POOL_CONN_TIMEOUT_MS,
    },
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    telegram: {
      enabled: Boolean(env.TELEGRAM_BOT_TOKEN.trim()),
      botToken: env.TELEGRAM_BOT_TOKEN.trim(),
      botUsername: env.TELEGRAM_BOT_USERNAME.trim().replace(/^@/, ""),
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET.trim(),
      webhookUrl: telegramWebhookUrl,
    },
  };
}

export const config: AppConfig = loadConfig();
