// Single content row: GET / PATCH / DELETE /api/admin/content/{id}
export const prerender = false;
import { getContentById, updateContent, deleteContent } from '@lib/queries';
import { itemHandlers } from '@lib/server/api-resource';
import { CONTENT_FIELDS, validateContent } from './index.js';

const { GET, PATCH, DELETE } = itemHandlers({
  fields: CONTENT_FIELDS,
  validate: validateContent,
  get: (id) => getContentById(id),
  update: (id, data) => updateContent(id, data),
  remove: (id) => deleteContent(id),
});

export { GET, PATCH, DELETE };
