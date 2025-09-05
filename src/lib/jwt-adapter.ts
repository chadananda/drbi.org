// JWT Adapter for Lucia - Stateless session storage using JWT tokens
import jwt from 'jsonwebtoken';
import type { Adapter, DatabaseSession, DatabaseUser, RegisteredDatabaseSessionAttributes } from "lucia";

interface JWTSessionData {
  id: string;
  userId: string;
  expiresAt: Date;
  attributes: Record<string, any>;
}

export class JWTAdapter implements Adapter {
  private jwtSecret: string;
  private adminUser: DatabaseUser;

  constructor(jwtSecret: string, adminUser: DatabaseUser) {
    this.jwtSecret = jwtSecret;
    this.adminUser = adminUser;
  }

  async getSessionAndUser(sessionId: string): Promise<[DatabaseSession | null, DatabaseUser | null]> {
    try {
      // Decode and verify JWT token (JWT library handles expiration automatically)
      const decoded = jwt.verify(sessionId, this.jwtSecret) as any;
      
      const session: DatabaseSession = {
        id: decoded.id,
        userId: decoded.userId,
        expiresAt: new Date(decoded.exp * 1000), // JWT uses 'exp' claim in seconds, Date needs milliseconds
        attributes: decoded.attributes || {}
      };

      // Only return the admin user for the correct userId
      if (decoded.userId === this.adminUser.id) {
        return [session, this.adminUser];
      }
      
      return [null, null];
    } catch (error) {
      // Invalid token, expired, or verification failed
      return [null, null];
    }
  }

  async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    // For stateless JWT sessions, we can't enumerate active sessions
    // This is a limitation of JWT approach but acceptable for single admin
    return [];
  }

  async setSession(session: DatabaseSession): Promise<void> {
    // Sessions are stored as JWT tokens, no storage needed
    // The JWT token is created when needed
  }

  async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    // JWT tokens are immutable, can't update expiration
    // This is a limitation but acceptable for our use case
  }

  async deleteSession(sessionId: string): Promise<void> {
    // JWT tokens are stateless, deletion is handled by cookie removal
  }

  async deleteUserSessions(userId: string): Promise<void> {
    // JWT tokens are stateless, deletion is handled by cookie removal
  }

  async deleteExpiredSessions(): Promise<void> {
    // JWT tokens handle expiration automatically
  }

  // Helper method to create a JWT session token
  createSessionToken(sessionData: any): string {
    // Remove expiresAt from payload since JWT creates its own 'exp' claim
    const { expiresAt, ...dataWithoutExpiry } = sessionData;
    return jwt.sign(dataWithoutExpiry, this.jwtSecret, {
      expiresIn: '7d' // This creates the 'exp' claim automatically
    });
  }
}