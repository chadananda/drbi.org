/**
 * API endpoint for post management
 * Provides CRUD operations for markdown posts
 */

import { 
  createPost, 
  updatePostById, 
  deletePostById, 
  readPostById,
  getAllPostsByType,
  searchPosts 
} from '../../utils/cms-utils.js';

export const prerender = false;

/**
 * Handle GET requests - Read posts
 */
async function handleGet(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type');
  const search = url.searchParams.get('search');

  try {
    if (id) {
      // Get specific post by ID
      const post = await readPostById(id);
      if (!post) {
        return new Response(JSON.stringify({ error: 'Post not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, data: post }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (search) {
      // Search posts
      const results = await searchPosts(search, type);
      return new Response(JSON.stringify({ success: true, data: results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (type) {
      // Get all posts by type
      const posts = await getAllPostsByType(type);
      return new Response(JSON.stringify({ success: true, data: posts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all posts from all types
      const [memorial, news, articles] = await Promise.all([
        getAllPostsByType('memorial'),
        getAllPostsByType('news'), 
        getAllPostsByType('article')
      ]);
      
      const allPosts = [...memorial, ...news, ...articles]
        .sort((a, b) => new Date(b.frontmatter.datePublished) - new Date(a.frontmatter.datePublished));

      return new Response(JSON.stringify({ success: true, data: allPosts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('GET /api/posts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle POST requests - Create new post
 */
async function handlePost(request) {
  try {
    const postData = await request.json();
    
    // Validate required fields
    if (!postData.title || !postData.content) {
      return new Response(JSON.stringify({ error: 'Title and content are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await createPost(postData);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Post created successfully',
      ...result
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('POST /api/posts error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        validationErrors: error.errors 
      }), {
        status: 422, // Unprocessable Entity
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle PUT requests - Update existing post
 */
async function handlePut(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates = await request.json();
    const result = await updatePostById(id, updates);
    
    if (result.success) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Post updated successfully',
        ...result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error || 'Failed to update post' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('PUT /api/posts error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        validationErrors: error.errors 
      }), {
        status: 422, // Unprocessable Entity
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle DELETE requests - Delete post
 */
async function handleDelete(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await deletePostById(id);
    
    if (result.success) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Post deleted successfully',
        ...result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error || 'Failed to delete post' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('DELETE /api/posts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Main API handler
 */
export async function GET(context) {
  return handleGet(context.request);
}

export async function POST(context) {
  return handlePost(context.request);
}

export async function PUT(context) {
  return handlePut(context.request);
}

export async function DELETE(context) {
  return handleDelete(context.request);
}