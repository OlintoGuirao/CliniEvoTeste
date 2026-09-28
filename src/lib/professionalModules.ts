export const MODULE_KEY_PROGRAMA_BOTOX = 'programa-botox';
export const MODULE_KEY_ANOTACOES = 'anotacoes';
export const MODULE_KEY_INSUMOS_NF = 'insumos-nf';
export const MODULE_KEY_ORCAMENTO = 'orcamento';
export const MODULE_KEY_RECEITUARIO = 'receituario';
export const MODULE_KEY_FLUXO_CAIXA = 'fluxo-caixa';
export const MODULE_KEY_COBRANCA = 'cobranca';
export const MODULE_KEY_DEPILACAO_LASER = 'depilacao-laser';
export const MODULE_KEY_ATENDIMENTO = 'atendimento';

type ProfileWithModules = { disabled_modules?: string[] | null } | null | undefined;

export function getDisabledModules(profile: ProfileWithModules): string[] {
  const disabled = profile?.disabled_modules;
  return Array.isArray(disabled) ? disabled : [];
}

export function isProfessionalModuleEnabled(profile: ProfileWithModules, moduleKey: string): boolean {
  return !getDisabledModules(profile).includes(moduleKey);
}

export function isProgramaBotoxModuleEnabled(profile: ProfileWithModules): boolean {
  return isProfessionalModuleEnabled(profile, MODULE_KEY_PROGRAMA_BOTOX);
}

export function isAnotacoesModuleEnabled(profile: ProfileWithModules): boolean {
  return isProfessionalModuleEnabled(profile, MODULE_KEY_ANOTACOES);
}

export function isCobrancaModuleEnabled(profile: ProfileWithModules): boolean {
  return isProfessionalModuleEnabled(profile, MODULE_KEY_COBRANCA);
}

export function isDepilacaoLaserModuleEnabled(profile: ProfileWithModules): boolean {
  return isProfessionalModuleEnabled(profile, MODULE_KEY_DEPILACAO_LASER);
}

export function isAtendimentoModuleEnabled(profile: ProfileWithModules): boolean {
  return isProfessionalModuleEnabled(profile, MODULE_KEY_ATENDIMENTO);
}
