// Single team member: GET / PATCH / DELETE /api/admin/team/{id}
export const prerender = false;
import { getTeamMember, updateTeamMember, deleteTeamMember } from '@lib/queries';
import { itemHandlers } from '@lib/server/api-resource';
import { TEAM_FIELDS, validateTeam } from './index.js';

const { GET, PATCH, DELETE } = itemHandlers({
  fields: TEAM_FIELDS,
  validate: validateTeam,
  get: (id) => getTeamMember(id),
  update: (id, data) => updateTeamMember(id, data),
  remove: (id) => deleteTeamMember(id),
});

export { GET, PATCH, DELETE };
