/**
 * GitHub CMS Integration
 * 
 * Handles committing content directly to GitHub with auto-sync for localhost
 */

import { Octokit } from '@octokit/rest';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

// Repository configuration (auto-detected from git remote)
const REPO_OWNER = 'chadananda';
const REPO_NAME = 'drbi.org';
const BRANCH = 'main';

// Initialize Octokit with token from environment
function getOctokit() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN not found in environment variables');
  }
  return new Octokit({ auth: token });
}

/**
 * Check if GitHub token is available
 * @returns {boolean}
 */
export function isGitHubConfigured() {
  return !!process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
}

/**
 * Get current branch SHA
 * @returns {Promise<string>} Current commit SHA
 */
async function getCurrentSHA() {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.getBranch({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    branch: BRANCH
  });
  return data.commit.sha;
}

/**
 * Check if file exists in repository
 * @param {string} filePath - Path to file in repository
 * @returns {Promise<string|null>} File SHA if exists, null otherwise
 */
async function getFileInfo(filePath) {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      ref: BRANCH
    });
    return { sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf8') };
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Commit file to GitHub
 * @param {string} filePath - Path to file in repository (e.g., 'src/content/memorial/post.md')
 * @param {string} content - File content
 * @param {string} message - Commit message
 * @param {string} authorName - Author name (optional)
 * @param {string} authorEmail - Author email (optional)
 * @returns {Promise<string>} Commit SHA
 */
export async function commitToGitHub(filePath, content, message, authorName = 'DRBI CMS', authorEmail = 'cms@drbi.org') {
  const octokit = getOctokit();

  // Check if file exists
  const fileInfo = await getFileInfo(filePath);
  const isUpdate = !!fileInfo;

  const params = {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: filePath,
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
    committer: {
      name: authorName,
      email: authorEmail,
    },
    author: {
      name: authorName,
      email: authorEmail,
    }
  };

  // If updating, include the file SHA
  if (isUpdate) {
    params.sha = fileInfo.sha;
  }

  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents(params);
    const commitSha = data.commit.sha;
    
    // Auto-sync for localhost development
    if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
      await autoSyncLocal();
    }
    
    return commitSha;
  } catch (error) {
    console.error('GitHub commit error:', error);
    throw new Error(`Failed to commit to GitHub: ${error.message}`);
  }
}

/**
 * Delete file from GitHub
 * @param {string} filePath - Path to file in repository
 * @param {string} message - Commit message
 * @returns {Promise<string>} Commit SHA
 */
export async function deleteFromGitHub(filePath, message) {
  const octokit = getOctokit();

  // Get file info first
  const fileInfo = await getFileInfo(filePath);
  if (!fileInfo) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const { data } = await octokit.rest.repos.deleteFile({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message,
      sha: fileInfo.sha,
      branch: BRANCH
    });

    const commitSha = data.commit.sha;
    
    // Auto-sync for localhost development
    if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
      await autoSyncLocal();
    }
    
    return commitSha;
  } catch (error) {
    console.error('GitHub delete error:', error);
    throw new Error(`Failed to delete from GitHub: ${error.message}`);
  }
}

/**
 * Auto-sync local repository with GitHub
 * Only runs in development environment
 */
async function autoSyncLocal() {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    // Don't sync in production
    return;
  }

  try {
    console.log('🔄 Auto-syncing local repository...');
    
    // Check if we have any local changes first
    const { stdout: status } = await exec('git status --porcelain');
    if (status.trim()) {
      console.log('⚠️  Local changes detected, skipping auto-sync to avoid conflicts');
      return;
    }

    // Pull latest changes
    const { stdout } = await exec('git pull origin main --rebase');
    console.log('✅ Local repository synced:', stdout.trim());
  } catch (error) {
    console.warn('⚠️  Auto-sync failed (this is usually not critical):', error.message);
    // Don't throw - auto-sync failure shouldn't break the CMS
  }
}

/**
 * Verify commit was successful
 * @param {string} commitSha - Commit SHA to verify
 * @returns {Promise<boolean>} True if commit exists
 */
export async function verifyCommit(commitSha) {
  const octokit = getOctokit();
  
  try {
    await octokit.rest.repos.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: commitSha
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get commit URL for display in admin interface
 * @param {string} commitSha - Commit SHA
 * @returns {string} GitHub commit URL
 */
export function getCommitUrl(commitSha) {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/${commitSha}`;
}

/**
 * Get recent commits for a specific file
 * @param {string} filePath - Path to file in repository
 * @param {number} limit - Number of commits to retrieve (default: 10)
 * @returns {Promise<Array>} Array of commit objects
 */
export async function getFileHistory(filePath, limit = 10) {
  const octokit = getOctokit();
  
  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      per_page: limit
    });
    
    return data.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url
    }));
  } catch (error) {
    console.error('Error getting file history:', error);
    return [];
  }
}

/**
 * Rollback to previous commit (emergency function)
 * @param {string} commitSha - SHA to rollback to
 * @returns {Promise<string>} New commit SHA
 */
export async function rollbackToCommit(commitSha) {
  const octokit = getOctokit();
  
  try {
    // Create a revert commit
    const { data } = await octokit.rest.repos.createCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      message: `Revert to commit ${commitSha.slice(0, 7)}`,
      tree: (await octokit.rest.git.getCommit({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        commit_sha: commitSha
      })).data.tree.sha,
      parents: [await getCurrentSHA()]
    });
    
    // Update branch reference
    await octokit.rest.git.updateRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
      sha: data.sha
    });
    
    return data.sha;
  } catch (error) {
    console.error('Rollback error:', error);
    throw new Error(`Failed to rollback: ${error.message}`);
  }
}