// JWT Adapter for Lucia — stateless sessions, user fetched from D1 per request.
// Uses `jose` (Web Crypto, Workers-native) instead of jsonwebtoken (Node-only).
import { SignJWT, jwtVerify } from 'jose';
import type { Adapter, DatabaseSession, DatabaseUser } from "lucia";

export class JWTAdapter implements Adapter {
  private secretKey: Uint8Array;
  private fallbackUser: DatabaseUser; // env-based admin, used when D1 has no matching user

  constructor(jwtSecret: string, fallbackUser: DatabaseUser) {
    this.secretKey = new TextEncoder().encode(jwtSecret);
    this.fallbackUser = fallbackUser;
  }

  async getSessionAndUser(sessionId: string): Promise<[DatabaseSession | null, DatabaseUser | null]> {
    try {
      const { payload } = await jwtVerify(sessionId, this.secretKey);
      const decoded = payload as any;
      const session: DatabaseSession = {
        id: decoded.id ?? sessionId,
        userId: decoded.userId,
        expiresAt: new Date((decoded.exp as number) * 1000),
        attributes: decoded.attributes || {}
      };

      // Look up user from D1 for current role/active status.
      try {
        const { getUserById } = await import('./queries');
        const userRow = await getUserById(decoded.userId);
        if (userRow && userRow.active) {
          return [session, {
            id: userRow.id,
            attributes: { name: userRow.name, email: userRow.email, role: userRow.role }
          }];
        }
      } catch {
        // D1 unavailable — fall through to env-admin fallback below.
      }

      // No matching/active D1 user (e.g. users table empty) — allow the env-based admin.
      if (decoded.userId === this.fallbackUser.id) {
        return [session, this.fallbackUser];
      }
      return [null, null];
    } catch {
      return [null, null];
    }
  }

  async getUserSessions(_userId: string): Promise<DatabaseSession[]> { return []; }
  async setSession(_session: DatabaseSession): Promise<void> {}
  async updateSessionExpiration(_sessionId: string, _expiresAt: Date): Promise<void> {}
  async deleteSession(_sessionId: string): Promise<void> {}
  async deleteUserSessions(_userId: string): Promise<void> {}
  async deleteExpiredSessions(): Promise<void> {}

  async createSessionToken(sessionData: any): Promise<string> {
    const { expiresAt: _exp, ...payload } = sessionData;
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.secretKey);
  }
}
