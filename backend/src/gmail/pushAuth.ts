import { google } from "googleapis";
import { config } from "../config.js";

export type PushTokenVerifier = (token: string, audience: string) => Promise<{ email?: string; emailVerified?: boolean } | null>;

/** Checks a Google-signed OIDC token: signature, expiry, and audience. */
const googleVerifier: PushTokenVerifier = async (token, audience) => {
  const client = new google.auth.OAuth2();
  const ticket = await client.verifyIdToken({ idToken: token, audience });
  const payload = ticket.getPayload();
  return payload ? { email: payload.email, emailVerified: payload.email_verified } : null;
};

let verifier: PushTokenVerifier = googleVerifier;

/** Tests swap in a fake verifier; pass nothing to restore Google's. */
export function setPushTokenVerifier(next?: PushTokenVerifier): void {
  verifier = next ?? googleVerifier;
}

/**
 * A push request is accepted only when push is configured and it carries a
 * token Google signed for our audience as our push service account.
 */
export async function isTrustedPush(authorization: string | undefined): Promise<boolean> {
  const { pubsubTopic, pushAudience, pushServiceAccount } = config.google;
  if (!pubsubTopic || !pushAudience || !pushServiceAccount) return false;
  if (!authorization?.startsWith("Bearer ")) return false;
  try {
    const claims = await verifier(authorization.slice(7), pushAudience);
    return Boolean(
      claims?.emailVerified && claims.email?.toLowerCase() === pushServiceAccount,
    );
  } catch {
    return false;
  }
}
