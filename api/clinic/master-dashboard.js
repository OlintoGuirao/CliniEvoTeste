/**
 * GET /api/clinic/master-dashboard
 * Dashboard executivo — exclusivo Master da Clínica (requireClinicOwner).
 */

import { enforceRateLimit } from '../_lib/rateLimit.js';
import { jsonResponse, requireClinicOwner } from '../_lib/clinicAuth.js';
import { buildClinicMasterDashboard } from '../_lib/clinicMasterDashboard.js';

export async function GET(request) {
  const blocked = await enforceRateLimit(request, 'admin', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;

  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;

  if (ctx.organization.type !== 'clinic') {
    return jsonResponse({ error: 'Dashboard disponível apenas para clínicas.' }, 403);
  }

  try {
    const payload = await buildClinicMasterDashboard(ctx, request);
    if (payload.error) {
      return jsonResponse({ error: payload.error }, payload.status ?? 400);
    }
    return jsonResponse(payload);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Erro ao carregar dashboard.' }, 500);
  }
}
