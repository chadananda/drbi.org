// Session lifetime policy. Long-lived on purpose (not a bank): 400 days = browsers' max cookie
// lifetime; any visit after RENEW_AFTER_DAYS silently re-issues the token, so active users never expire.
export const SESSION_DAYS = 400;
export const RENEW_AFTER_DAYS = 1;

const DAY = 24 * 60 * 60 * 1000;
export const sessionExpiry = (now = Date.now()) => new Date(now + SESSION_DAYS * DAY);
export const needsRenewal = (expiresAt, now = Date.now()) =>
  new Date(expiresAt).getTime() - now < (SESSION_DAYS - RENEW_AFTER_DAYS) * DAY;
