/**
 * API endpoint for CMS status and configuration
 * Provides information about GitHub connectivity and environment
 */

import { isGitHubConfigured } from '../../utils/github-cms.js';

export const prerender = false;

/**
 * Handle GET requests - Get CMS status
 */
async function handleGet(request) {
  try {
    const isGitHubAvailable = isGitHubConfigured();
    const isProduction = process.env.VERCEL || false;
    const isDevelopment = !isProduction;
    const useGitHub = isGitHubAvailable && (isProduction || process.env.CMS_USE_GITHUB === 'true');
    
    const status = {
      environment: isProduction ? 'production' : 'development',
      github: {
        configured: isGitHubAvailable,
        enabled: useGitHub,
        repository: 'chadananda/drbi.org'
      },
      validation: {
        strict: process.env.CMS_VALIDATE_STRICT !== 'false',
        buildCheck: process.env.CMS_BUILD_CHECK === 'true'
      },
      features: {
        autoSync: isDevelopment && isGitHubAvailable,
        localFallback: true,
        realTimeValidation: true
      }
    };
    
    return new Response(JSON.stringify({
      success: true,
      status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('GET /api/cms-status error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Main API handlers
 */
export async function GET(context) {
  return handleGet(context.request);
}