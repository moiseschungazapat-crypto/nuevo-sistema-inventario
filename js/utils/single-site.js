export const OPERATIONAL_SITE_NAME = 'La Liguria S.A.';
export const OPERATIONAL_SITE_ADDRESS = 'Av. Arica 281';

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/** Resolve the site used by this single-site deployment. */
export function operationalSite(sites) {
  const active = (sites || []).filter(site => site && site.estado !== false);
  const address = normalize(OPERATIONAL_SITE_ADDRESS);
  const name = normalize(OPERATIONAL_SITE_NAME);
  return active.find(site => normalize(site.direccion).includes(address) && normalize(site.nombre) === name)
    || active.find(site => normalize(site.direccion).includes(address))
    || null;
}

export function operationalSiteLabel(site = {}) {
  return `${site.nombre || OPERATIONAL_SITE_NAME} · ${site.direccion || OPERATIONAL_SITE_ADDRESS}`;
}

export function operationalSiteError(sites) {
  const active = (sites || []).filter(site => site && site.estado !== false);
  if (!active.length) return `Configura una sede activa para ${OPERATIONAL_SITE_NAME} (${OPERATIONAL_SITE_ADDRESS}) antes de registrar operaciones.`;
  if (!operationalSite(active)) return `No se encontró la sede ${OPERATIONAL_SITE_NAME} en ${OPERATIONAL_SITE_ADDRESS}. Revisa el catálogo de Sedes para evitar registrar operaciones en una sede incorrecta.`;
  return null;
}
