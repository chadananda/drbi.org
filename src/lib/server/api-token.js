// :arch: constant-time equality for the service API token (Bearer / X-API-Key).
// :why: the events+content write API is reachable by non-interactive tools (Claude Code); a
//       dedicated revocable token beats sharing a user session. Blank never matches blank.
// :rules: both sides must be non-empty strings; comparison is length-safe and time-constant.
export function isApiTokenMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
