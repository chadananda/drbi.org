export const prerender = false;
// :arch: serves the DRBI Internal API OpenAPI 3.1 spec at /api/openapi.json for Claude Code / tooling.
// :why: single machine-readable contract for the content (/api/posts) + events CRUD surface.
// :rules: keep in sync with src/pages/api/events*.js and src/pages/api/posts.js on any change.
const eventInputProps = {
  title: { type: 'string', description: 'Event title (required on create).' },
  startDate: { type: 'string', description: 'ISO start datetime (required on create).' },
  endDate: { type: 'string', description: 'ISO end datetime.' },
  shortDescription: { type: 'string', description: 'One-line summary (meta/OG description).' },
  fullDescription: { type: 'string', description: 'Body HTML for the event detail page.' },
  location: {
    type: 'object', description: 'Canonical shape.',
    properties: { venue: { type: 'string' }, address: { type: 'string' }, online: { type: 'string', description: 'Online/meeting URL.' } },
  },
  price: { description: 'Array of {label,...} tiers, or null for free.', nullable: true },
  registrationUrl: { type: 'string', description: 'Sign-up link (http(s)).' },
  mainImage: { type: 'string', description: 'Hero image URL (cdn.shrtr.com/drbi.org/...).' },
  teacherImage: { type: 'string' },
  images: { type: 'array', items: { type: 'string' } },
  highlights: { type: 'array', items: { type: 'string' } },
  eventSchedule: { type: 'array', items: { type: 'object' } },
  organizer: { type: 'string', default: 'DRBI' },
  categories: { type: 'array', items: { type: 'string' } },
  visible: { type: 'boolean', description: 'Shown on the public site.' },
  featured: { type: 'boolean' },
  capacity: { type: 'integer', nullable: true, description: 'Seat cap; when reached the public page shows a waitlist form.' },
  waitlistOverride: { type: 'string', nullable: true, enum: ['open', 'closed', null], description: 'Force the waitlist open/closed regardless of count.' },
};

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'DRBI Internal API',
    version: '1.0.0',
    description:
      'Content and event management for drbi.org, backed by Cloudflare D1 — writes are live immediately, no redeploy.\n\n' +
      '**Auth:** send the service token as `Authorization: Bearer <API_TOKEN>` or `X-API-Key: <API_TOKEN>` (superadmin). ' +
      'A Lucia session JWT works as `Authorization: Bearer <jwt>` too. Cross-origin write calls must also send an `Origin: https://drbi.org` header (Astro CSRF).\n\n' +
      '**Scope:** free/non-ticketed events (`source: manual`) are fully writable. Humanitix-sourced (paid) events are read-only here — create/edit them in Humanitix; the website only toggles their visibility.',
  },
  servers: [{ url: 'https://drbi.org' }],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  tags: [
    { name: 'Events', description: 'Free/manual events. Paid events come from Humanitix and are read-only.' },
    { name: 'Content', description: 'Articles, news, memorial (the content collection).' },
  ],
  paths: {
    '/api/events': {
      get: {
        tags: ['Events'], summary: 'List events',
        parameters: [
          { name: 'all', in: 'query', schema: { type: 'boolean' }, description: 'Include hidden events (requires auth).' },
          { name: 'upcoming', in: 'query', schema: { type: 'boolean' }, description: 'Only upcoming visible events.' },
          { name: 'source', in: 'query', schema: { type: 'string', enum: ['manual', 'humanitix'] }, description: 'Filter by source.' },
        ],
        responses: { '200': { description: 'Array of events', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } } } },
      },
      post: {
        tags: ['Events'], summary: 'Create a manual (free) event', security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EventInput' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'string' }, slug: { type: 'string' }, url: { type: 'string' }, event: { $ref: '#/components/schemas/Event' } } } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '409': { description: 'Slug conflict (same title + year already exists)' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/events/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Events'], summary: 'Get one event', security: [{ bearerAuth: [] }, { apiKeyAuth: [] }], responses: { '200': { description: 'Event', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, event: { $ref: '#/components/schemas/Event' } } } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } } },
      patch: {
        tags: ['Events'], summary: 'Update a manual event (partial)', security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EventInput' }, examples: { visibility: { value: { visible: true } }, capacity: { value: { capacity: 80, waitlistOverride: 'open' } } } } } },
        responses: { '200': { description: 'Updated event', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, event: { $ref: '#/components/schemas/Event' } } } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '403': { description: 'Event is Humanitix-managed (read-only)' }, '404': { $ref: '#/components/responses/NotFound' }, '422': { $ref: '#/components/responses/ValidationError' } },
      },
      delete: { tags: ['Events'], summary: 'Delete a manual event', security: [{ bearerAuth: [] }, { apiKeyAuth: [] }], responses: { '200': { description: 'Deleted' }, '401': { $ref: '#/components/responses/Unauthorized' }, '403': { description: 'Event is Humanitix-managed (read-only)' }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/posts': {
      get: {
        tags: ['Content'], summary: 'List / get / search content',
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'string' }, description: 'Fetch one item by id.' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['articles', 'news', 'memorial'] }, description: 'Filter by collection.' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Full-text over title/body.' },
        ],
        responses: { '200': { description: 'Content list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Post' } } } } } } } },
      },
      post: {
        tags: ['Content'], summary: 'Create or delete content', security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['create', 'delete'] }, type: { type: 'string', enum: ['articles', 'news', 'memorial'], default: 'articles' }, title: { type: 'string' }, content: { type: 'string', description: 'Markdown body.' }, slug: { type: 'string' }, postId: { type: 'string', description: 'For action=delete.' }, frontmatter: { $ref: '#/components/schemas/PostFrontmatter' } } } } } },
        responses: { '201': { description: 'Created' }, '200': { description: 'Deleted' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
      put: {
        tags: ['Content'], summary: 'Update content', security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, frontmatter: { $ref: '#/components/schemas/PostFrontmatter' } } } } } },
        responses: { '200': { description: 'Updated' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'API_TOKEN (superadmin) or a Lucia session JWT.' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'The service API_TOKEN.' },
    },
    responses: {
      Unauthorized: { description: 'Missing or invalid credentials' },
      NotFound: { description: 'Resource not found' },
      ValidationError: { description: 'Input failed validation', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } } } } } },
    },
    schemas: {
      EventInput: { type: 'object', required: ['title', 'startDate'], properties: eventInputProps, description: 'On create, source is always forced to "manual" — it cannot be set via the API.' },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          data: { type: 'object', description: 'Shaped event (camelCase). Includes all EventInput fields plus: source, externalId, sourcePublished, registeredCount, manuallyEdited, lastSynced.', properties: { ...eventInputProps, source: { type: 'string' }, registeredCount: { type: 'integer' }, sourcePublished: { type: 'boolean' } } },
        },
      },
      Post: { type: 'object', properties: { id: { type: 'string' }, collection: { type: 'string' }, slug: { type: 'string' }, content: { type: 'string' }, frontmatter: { $ref: '#/components/schemas/PostFrontmatter' } } },
      PostFrontmatter: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, draft: { type: 'boolean' }, author: { type: 'string' }, topics: { type: 'array', items: { type: 'string' } }, keywords: { type: 'array', items: { type: 'string' } }, datePublished: { type: 'string' }, image: { type: 'object', properties: { src: { type: 'string' }, alt: { type: 'string' } } } } },
    },
  },
};

export const GET = async () =>
  new Response(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
