#!/usr/bin/env node
/**
 * Test script for GitHub CMS functionality
 * Tests validation, GitHub status, and basic CMS operations in local mode
 */

import dotenv from 'dotenv';
import { createPost, updatePost, deletePost } from './src/utils/cms-utils.js';
import { isGitHubConfigured } from './src/utils/github-cms.js';
import { validateContent, quickValidate } from './src/utils/content-validation.js';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

console.log('🧪 Testing GitHub CMS Integration\n');

// Test 1: Check GitHub configuration
console.log('1️⃣  Testing GitHub Configuration...');
const isGitHubAvailable = isGitHubConfigured();
if (isGitHubAvailable) {
  console.log('✅ GitHub token configured');
} else {
  console.log('⚠️  GitHub token not configured (will use local mode)');
}

// Test 2: Quick validation
console.log('\n2️⃣  Testing Quick Validation...');
const testPost = {
  title: 'Test Post',
  content: '# Test Content\n\nThis is a test post with some content.',
  type: 'article'
};

const validationErrors = quickValidate(testPost);
if (validationErrors.length === 0) {
  console.log('✅ Quick validation passed');
} else {
  console.log('❌ Quick validation failed:', validationErrors);
}

// Test 3: Full validation
console.log('\n3️⃣  Testing Full Validation...');
try {
  const frontmatter = {
    title: testPost.title,
    language: 'en',
    url: '/test/test-post',
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    draft: false
  };
  
  const matter = await import('gray-matter');
  const fileContent = matter.default.stringify(testPost.content, frontmatter);
  
  await validateContent(testPost, fileContent, 'src/content/articles/test-post.md');
  console.log('✅ Full validation passed');
} catch (error) {
  if (error.name === 'ValidationError') {
    console.log('❌ Full validation failed:', error.errors);
  } else {
    console.log('❌ Validation error:', error.message);
  }
}

// Test 4: Create post (local mode)
console.log('\n4️⃣  Testing Post Creation (Local Mode)...');
try {
  // Force local mode for testing
  const originalEnv = process.env.CMS_USE_GITHUB;
  process.env.CMS_USE_GITHUB = 'false';
  
  const result = await createPost({
    title: 'Test CMS Post',
    content: '# Test CMS Post\n\nThis post was created by the CMS test script.\n\n## Features Tested\n\n- Content creation\n- Validation\n- File system operations\n\n**Note**: This is a temporary test post.',
    type: 'article',
    author: 'CMS Test',
    email: 'test@drbi.org'
  });
  
  if (result.method === 'local') {
    console.log('✅ Post created successfully in local mode');
    console.log(`   📁 File: ${result.filePath}`);
    
    // Test 5: Update post
    console.log('\n5️⃣  Testing Post Update...');
    const updateResult = await updatePost(result.filePath, {
      content: result.content + '\n\n**Updated**: This post has been updated by the test script.',
      author: 'CMS Test Updater',
      email: 'test-update@drbi.org'
    });
    
    if (updateResult.success) {
      console.log('✅ Post updated successfully');
    } else {
      console.log('❌ Post update failed:', updateResult.error);
    }
    
    // Test 6: Delete post (cleanup)
    console.log('\n6️⃣  Testing Post Deletion (Cleanup)...');
    const deleteResult = await deletePost(result.filePath);
    
    if (deleteResult.success) {
      console.log('✅ Test post deleted successfully (cleanup completed)');
    } else {
      console.log('❌ Post deletion failed:', deleteResult.error);
      console.log('⚠️  You may need to manually delete:', result.filePath);
    }
  } else {
    console.log('❌ Expected local mode but got:', result.method);
  }
  
  // Restore environment
  if (originalEnv) {
    process.env.CMS_USE_GITHUB = originalEnv;
  } else {
    delete process.env.CMS_USE_GITHUB;
  }
} catch (error) {
  console.log('❌ Post creation failed:', error.message);
}

// Test 7: Environment detection
console.log('\n7️⃣  Testing Environment Detection...');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Vercel: ${process.env.VERCEL ? 'Yes' : 'No'}`);
console.log(`   GitHub Token: ${isGitHubAvailable ? 'Configured' : 'Not configured'}`);
console.log(`   CMS Use GitHub: ${process.env.CMS_USE_GITHUB || 'Not set'}`);
console.log(`   Validation Strict: ${process.env.CMS_VALIDATE_STRICT !== 'false' ? 'Yes' : 'No'}`);
console.log(`   Build Check: ${process.env.CMS_BUILD_CHECK === 'true' ? 'Yes' : 'No'}`);

console.log('\n🎉 GitHub CMS Integration Test Complete!');

process.exit(0);