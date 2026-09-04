// Team members: GET list / POST create.
export const prerender = false;
import { getTeam, createTeamMember } from '@lib/queries';
import { collectionHandlers } from '@lib/server/api-resource';

export const TEAM_FIELDS = [
  'name', 'slug', 'role', 'title', 'bio', 'email', 'image_src', 'image_alt',
  'sort_order', 'active', 'links',
];

export function validateTeam(data, mode) {
  if (mode === 'create' && !data.name) return 'name is required';
  if (data.email !== undefined && data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(data.email))) {
    return 'email is not a valid address';
  }
  return null;
}

const { GET, POST } = collectionHandlers({
  fields: TEAM_FIELDS,
  validate: validateTeam,
  list: () => getTeam(),
  create: (data) => createTeamMember(data),
});

export { GET, POST };
