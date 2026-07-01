// Shared session creation for all sign-in methods (password, magic-link, Google One Tap).
// Creates a Lucia (jose-JWT) session for a resolved user and sets the auth cookie.
import { lucia } from './auth';
import { logoutUser } from '@utils/utils';

export async function startSession(Astro: any, userId: string, role: string) {
  await logoutUser(Astro).catch(() => {});
  const session = await lucia.createSession(userId, { role });
  Astro.cookies.set(lucia.sessionCookieName, session.id, {
    httpOnly: true,
    secure: import.meta.env.APP_ENV !== 'dev',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
}
