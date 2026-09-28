/**
 * Navegação do master da clínica: visão gerencial por filial.
 * Contas solo nunca passam por estes filtros (isMaster=false).
 * Admin do salão (cabeleireiro) NÃO usa este hide — continua atendendo e vendo clientes.
 */

const CLINIC_MASTER_HIDDEN_PATHS = [
  '/consultation',
  '/agenda',
  '/patients',
  '/cobranca',
  '/programa-botox',
  '/depilacao-laser',
  '/operacional',
  '/atendimento',
  '/anotacoes',
  '/orcamento',
  '/receituario',
  '/settings/whatsapp',
] as const;

export function isClinicMasterNavHidden(path: string, isMaster: boolean): boolean {
  if (!isMaster) return false;
  const normalized = path.split('?')[0];
  if (CLINIC_MASTER_HIDDEN_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return true;
  }
  if (normalized.startsWith('/procedures/')) return true;
  return false;
}

export function filterNavForClinicMaster<T extends Record<string, unknown>>(
  items: T[],
  isMaster: boolean,
  pathKey: 'url' | 'path' = 'url'
): T[] {
  if (!isMaster) return items;
  return items.filter((item) => {
    const path = String(item[pathKey] ?? '');
    return !isClinicMasterNavHidden(path, true);
  });
}

/** Atalhos do dashboard master — saúde financeira e gestão. Labels de equipe vêm do uiCopy. */
export const CLINIC_MASTER_DASHBOARD_ACTIONS = [
  { href: '/faturamento', label: 'Faturamento' },
  { href: '/fluxo-caixa', label: 'Fluxo de caixa' },
  { href: '/insumos-nf', label: 'Entradas NF (Insumos)' },
  { href: '/settings/filiais', label: 'Filiais' },
  { href: '/settings/equipe', label: 'Equipe da clínica', labelKey: 'team' as const },
  { href: '/settings/procedimentos', label: 'Procedimentos e preços' },
  { href: '/settings/origens', label: 'Origens' },
  { href: '/settings/tipos-ficha', label: 'Tipos de ficha' },
] as const;
