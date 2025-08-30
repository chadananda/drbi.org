/**
 * API endpoint for real-time content validation
 * Provides quick validation feedback for the admin interface
 */

import { quickValidate } from '../../utils/content-validation.js';

export const prerender = false;

/**
 * Handle POST requests - Validate content
 */
async function handlePost(request) {
  try {
    const postData = await request.json();
    
    // Perform quick validation (synchronous checks only)
    const errors = quickValidate(postData);
    
    return new Response(JSON.stringify({
      valid: errors.length === 0,
      errors
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('POST /api/validate error:', error);
    return new Response(JSON.stringify({ 
      valid: false,
      errors: [`Validation error: ${error.message}`]
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Main API handlers
 */
export async function POST(context) {
  return handlePost(context.request);
}