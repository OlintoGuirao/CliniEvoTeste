/** Espelho da função administrativa em profiles.professional_registry_body quando não há conselho. */
export const STAFF_REGISTRY_PREFIX = '__STAFF__:';

export function encodeStaffRegistryBody(staffTitle) {
  const id = staffTitle?.trim();
  if (!id) return null;
  return `${STAFF_REGISTRY_PREFIX}${id}`;
}

export function parseMemberCouncilAndStaff(councilBody, staffTitle) {
  const body = councilBody?.trim() || null;
  if (body?.startsWith(STAFF_REGISTRY_PREFIX)) {
    const fromBody = body.slice(STAFF_REGISTRY_PREFIX.length).trim() || null;
    return {
      councilBody: null,
      staffTitle: staffTitle?.trim() || fromBody,
    };
  }
  return {
    councilBody: body,
    staffTitle: staffTitle?.trim() || null,
  };
}

export function resolveProfileRegistryBody(councilBody, staffTitle) {
  const council = councilBody?.trim() || null;
  if (council) return council;
  return encodeStaffRegistryBody(staffTitle);
}

export function isClinicalCouncilBody(councilBody) {
  const body = councilBody?.trim();
  return Boolean(body && !body.startsWith(STAFF_REGISTRY_PREFIX));
}
