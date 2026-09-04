// Team members: GET list / POST create.
export const prerender = false;
import { getTeam, createTeamMember } from '@lib/queries';
import { collectionHandlers } from '@lib/server/api-resource';

// Mirrors the actual `team` columns — id, name, role, title, bio, image, email,
// website, twitter, sort_order. Anything outside this list is ignored on write.
export const TEAM_FIELDS = [
  'id', 'name', 'role', 'title', 'bio', 'image', 'email', 'website', 'twitter', 'sort_order',
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
