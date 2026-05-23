# GitHub CMS Integration

The existing authenticated API endpoint `/api/post_db` has been enhanced with GitHub commit functionality while preserving all existing database operations.

## ✅ **Integration Complete**

The GitHub CMS functionality is now properly integrated into your existing authenticated API endpoint where it can access server-side environment variables securely.

## 🔧 **How It Works**

### **Existing Functionality (Preserved)**
- All existing database operations continue to work unchanged
- Authentication with Lucia middleware 
- Team member validation
- GET/POST/DELETE endpoints

### **New GitHub Integration**
- **Server-side only** - GitHub operations happen where environment variables are accessible
- **Optional** - GitHub commits only happen when explicitly requested
- **Authenticated** - Uses existing auth middleware and team member validation
- **Fallback safe** - If GitHub fails, database operations still succeed

## 📡 **Enhanced API Usage**

### **Save with GitHub Commit**
```javascript
// Client-side: Include githubCommit flag in POST request
const response = await fetch('/api/post_db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionId}`
  },
  body: JSON.stringify({
    id: 'post-123',
    data: { /* post metadata */ },
    body: '# Post Content\n\nPost body in markdown...',
    githubCommit: true  // ← NEW: Request GitHub commit
  })
});

const result = await response.json();
// Response includes both database and GitHub results:
// {
//   success: true,
//   post: { /* updated post from database */ },
//   dbSaved: true,
//   githubCommitted: true,
//   github: {
//     filePath: 'src/content/articles/my-post.md',
//     commitSha: 'abc123...',
//     commitUrl: 'https://github.com/chadananda/drbi.org/commit/abc123...',
//     method: 'github'
//   },
//   message: 'Post saved to database and committed to GitHub'
// }
```

### **Save Database Only (Default)**
```javascript
// Client-side: Omit githubCommit or set to false
const response = await fetch('/api/post_db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionId}`
  },
  body: JSON.stringify({
    id: 'post-123',
    data: { /* post metadata */ },
    body: '# Post Content\n\nPost body in markdown...'
    // githubCommit: false (default)
  })
});

const result = await response.json();
// Response focuses on database:
// {
//   success: true,
//   post: { /* updated post from database */ },
//   dbSaved: true,
//   githubCommitted: false,
//   message: 'Post saved to database (GitHub commit skipped)'
// }
```

### **Delete with GitHub**
```javascript
// Client-side: Include github=true query parameter
const response = await fetch('/api/post_db?id=post-123&github=true', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${sessionId}`
  }
});
```

## 🗂️ **Database to Markdown Conversion**

The integration automatically converts database post format to CMS markdown format:

### **Database Post → Markdown File**
- **`title`** → Frontmatter `title` + filename generation
- **`body/content`** → Markdown content
- **`category`** → Determines post type (memorial/news/article)
- **`abstract/description`** → Frontmatter `description`
- **`topics`** → Split comma-separated into array
- **`keywords`** → Split comma-separated into array
- **`author`** → Frontmatter `author`
- **`dateCreated/lastModified`** → ISO timestamps
- **`image`** → Frontmatter image object

### **Generated Paths**
- Memorial post: `src/content/memorial/john-doe.md`
- News post: `src/content/news/latest-update.md`
- Article: `src/content/articles/my-article.md`

## ⚙️ **Environment Configuration**

### **Required (Production)**
```bash
# Vercel Environment Variables
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx
```

### **Optional (Development)**
```bash
# .env file
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx
CMS_USE_GITHUB=true              # Force GitHub commits in development
CMS_VALIDATE_STRICT=true         # Enable strict validation (default)
CMS_BUILD_CHECK=true             # Enable build checks before commits
```

## 🔐 **Security & Authentication**

- **Server-side only** - GitHub operations happen only on server where env vars are accessible
- **Authenticated** - Uses existing Lucia authentication
- **Team member validation** - Requires valid team member
- **Role-based access** - Requires admin/editor/author role
- **Optional commits** - GitHub operations only when explicitly requested

## 🚀 **Production Flow**

1. **User edits content** in existing CMS interface
2. **Client sends POST** to `/api/post_db` with `githubCommit: true`
3. **Server authenticates** user and validates team membership
4. **Database save** happens first (existing functionality)
5. **GitHub commit** happens second (new functionality)
6. **Vercel rebuilds** automatically on commit
7. **Changes go live** in ~30 seconds

## 🛠️ **Development Flow**

1. **User edits content** locally
2. **Client sends POST** with `githubCommit: true` (optional)
3. **GitHub commit** with auto-sync pulls changes back
4. **Local repository** stays synchronized
5. **No manual git pulls** required

## 📊 **Validation & Safety**

- **Pre-commit validation** prevents broken builds
- **Fallback handling** ensures database saves even if GitHub fails
- **Content validation** checks markdown syntax, links, images
- **Error reporting** distinguishes between database and GitHub failures

## 🎯 **Benefits Achieved**

✅ **Content persists across deployments** - Stored in Git repository  
✅ **No client-side environment variables** - All GitHub operations server-side  
✅ **Preserves existing workflow** - Database operations unchanged  
✅ **Optional GitHub integration** - Can be enabled per-request  
✅ **Authenticated and secure** - Uses existing auth middleware  
✅ **Automatic rebuilds** - Vercel rebuilds on GitHub commits  
✅ **Auto-sync development** - No manual git pulls needed  
✅ **Comprehensive validation** - Prevents broken builds  
✅ **Full Git history** - Every change tracked in version control  

The GitHub CMS integration is now ready for production use! 🚀