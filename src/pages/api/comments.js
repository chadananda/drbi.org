// Simple comment API with OpenAI moderation
export const prerender = false;

import { sanitizeInput, moderateCommentWithOpenAI, addCommentToFile, commitCommentToGitHub } from '@utils/utils.js';

export const POST = async ({ request }) => {
  if (request.headers.get("Content-Type") === "application/json") {
    try {
      let { postid, parentid, name, content, website, phone } = await request.json();
      
      // Basic validation and sanitization
      name = sanitizeInput(name, 40);
      content = sanitizeInput(content, 2000);
      
      // Check for spam indicators
      const isValidSubmission = !!name && !!content && !website && !phone && !content.includes('http');
      
      if (!isValidSubmission) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid submission - possible spam detected'
        }), { status: 400 });
      }
      
      // Create comment object for moderation
      const commentToModerate = {
        name,
        content,
        postid,
        parentid
      };
      
      // Get post context for better moderation
      let postDescription = '';
      try {
        const { getPostFromSlug } = await import('@utils/content-utils.js');
        const post = await getPostFromSlug(postid);
        postDescription = post?.data?.description || post?.data?.title || '';
      } catch (error) {
        console.log('Could not fetch post context for moderation:', error.message);
      }
      
      // Moderate comment with OpenAI
      const moderationResult = await moderateCommentWithOpenAI(commentToModerate, postDescription);
      
      if (!moderationResult.approved) {
        // Comment rejected - don't save, return rejection
        return new Response(JSON.stringify({
          success: false,
          rejected: true,
          reason: moderationResult.reason,
          confidence: moderationResult.confidence
        }), { status: 200 });
      }
      
      // Comment approved - save to JSON file
      const approvedComment = {
        id: Math.random().toString(36).substr(2, 12),
        postid,
        parentid: parentid || null,
        name,
        content,
        date: new Date().toISOString(),
        moderated: true,
        starred: false,
        ai_score: moderationResult.confidence
      };
      
      // Save comment
      const savedComment = await addCommentToFile(postid, approvedComment);
      
      // Auto-commit to GitHub in production
      if (process.env.NODE_ENV === 'production') {
        try {
          await commitCommentToGitHub(
            `src/data/comments/${postid}.json`,
            `New comment from ${name} on ${postid}`
          );
        } catch (error) {
          console.error('GitHub commit failed:', error);
          // Don't fail the request if commit fails
        }
      }
      
      // Return success with comment data
      return new Response(JSON.stringify({
        success: true,
        comment: savedComment,
        moderation: {
          approved: true,
          confidence: moderationResult.confidence
        }
      }), { status: 200 });
      
    } catch (error) {
      console.error('Comment submission error:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Server error processing comment'
      }), { status: 500 });
    }
  }
  
  return new Response(JSON.stringify({
    success: false,
    error: 'Invalid request format'
  }), { status: 400 });
};