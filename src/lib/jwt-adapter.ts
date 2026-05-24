// JWT Adapter for Lucia — stateless sessions, user data fetched from Turso on each request
import jwt from 'jsonwebtoken';
import type { Adapter, DatabaseSession, DatabaseUser } from "lucia";

export class JWTAdapter implements Adapter {
  private jwtSecret: string;
  private fallbackUser: DatabaseUser; // used if Turso is unavailable

  constructor(jwtSecret: string, fallbackUser: DatabaseUser) {
    this.jwtSecret = jwtSecret;
    this.fallbackUser = fallbackUser;
  }

  async getSessionAndUser(sessionId: string): Promise<[DatabaseSession | null, DatabaseUser | null]> {
    try {
      const decoded = jwt.verify(sessionId, this.jwtSecret) as any;
      const session: DatabaseSession = {
        id: decoded.id ?? sessionId,
        userId: decoded.userId,
        expiresAt: new Date(decoded.exp * 1000),
        attributes: decoded.attributes || {}
      };

      // Look up user from Turso for current role/active status
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
        // Turso unavailable — fall back to env-based admin
        if (decoded.userId === this.fallbackUser.id) {
          return [session, this.fallbackUser];
        }
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

  createSessionToken(sessionData: any): string {
    const { expiresAt: _exp, ...payload } = sessionData;
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
  }
}
