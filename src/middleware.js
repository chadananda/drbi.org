// src/middleware.js
import { checkUser } from '@utils/authCheck';

export async function onRequest({ locals, request }, next) {
    try {
        const currentUrl = new URL(request.url);
        if (currentUrl.pathname.startsWith('/admin')) {
            const user = await checkUser(request);
            locals.user = user; // local user info for application
            if (!user.authenticated) {
                // Redirect unauthenticated users to the login page
                // the Vercel CLI changes port on localhost, so we fix it for local dev
                const loginURL = new URL('/login', currentUrl.origin).href
                    .replace('[::1]', 'localhost').replace(/localhost:(\d+)/, 'localhost:3000');
                //console.log('Middleware redirecting to:', loginURL);
                return Response.redirect(loginURL, 302);
            }
        }
        return next();
    } catch (error) {
        console.error('Error in middleware:', error);
        return next();
    }
}

export const config = {
    matcher: '/admin/*' // Apply this middleware only to paths under '/admin'
};
