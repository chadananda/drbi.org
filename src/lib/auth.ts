// JWT-based authentication using custom adapter
import { Lucia } from "lucia";
import { JWTAdapter } from "./jwt-adapter";
import type { DatabaseUser } from "lucia";
import site from '@data/site.json';

// Create admin user from environment variables
const adminUser: DatabaseUser = {
	id: site.author.toLowerCase().replace(/\s+/g, '-'), // slug from site author
	attributes: {
		name: site.author,
		role: 'superadmin',
		email: import.meta.env.SITE_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@example.com'
	}
};

// Initialize JWT adapter with admin user
const jwtSecret = import.meta.env.PRIVATE_JWT_SECRET;
if (!jwtSecret) {
	throw new Error('PRIVATE_JWT_SECRET environment variable is required');
}

const adapter = new JWTAdapter(jwtSecret, adminUser);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			// set to `true` when using HTTPS
			secure: import.meta.env.APP_ENV !== 'dev'
		}
	},
	getUserAttributes: (attributes) => {
		return {
			// attributes has the type of DatabaseUserAttributes
			name: attributes.name,
			role: attributes.role,
			email: attributes.email
		};
	}
});

// Override createSession to return JWT token as session ID
const originalCreateSession = lucia.createSession.bind(lucia);
lucia.createSession = async (userId: string, attributes?: Record<string, any>) => {
	const sessionId = Math.random().toString(36).substring(2, 15);
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
	const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000); // JWT exp in seconds
	
	const sessionData = {
		id: sessionId,
		userId,
		attributes: attributes || {}
	};
	
	// Create JWT token
	const jwtToken = adapter.createSessionToken(sessionData);
	
	// Return session with JWT token as ID
	return {
		id: jwtToken,
		userId,
		expiresAt,
		fresh: true
	};
};

// Export admin user for login validation
export { adminUser, adapter };

declare module "lucia" {
	 interface Register {
		  Lucia: typeof lucia;
				DatabaseUserAttributes: DatabaseUserAttributes;
	 }
}

interface DatabaseUserAttributes {
	id: string;  // user name slug
	name: string; // full name
	email: string;
	hashed_password: string;
	role: string;
}

