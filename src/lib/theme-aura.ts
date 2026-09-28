/**
 * Tema Aura: novo tema estruturalmente idêntico ao tema atual (Light/Dark),
 * com paleta baseada em uma única cor base. Não altera temas existentes.
 *
 * COR_BASE: altere AURA_BASE_HUE para mudar toda a identidade do tema Aura.
 */

/** Cor base do tema Aura (HSL hue 0–360). Alterar aqui atualiza AuraLight e AuraDark. */
export const AURA_BASE_HUE = 173;

/** Cor de preview para o seletor de tema (hex). Corresponde à identidade visual do tema Aura. */
export const AURA_PREVIEW_HEX = '#2d8a7a';

const h = AURA_BASE_HUE;

/** Mesma estrutura de tokens que :root em index.css — apenas valores de cor derivados da COR_BASE */
export function buildAuraLightVars(): Record<string, string> {
  return {
    '--background': `${h} 20% 99%`,
    '--foreground': `${h} 30% 15%`,
    '--card': `${h} 15% 100%`,
    '--card-foreground': `${h} 30% 15%`,
    '--popover': `${h} 15% 100%`,
    '--popover-foreground': `${h} 30% 15%`,
    '--primary': `${h} 58% 39%`,
    '--primary-foreground': '0 0% 100%',
    '--secondary': `${h} 30% 95%`,
    '--secondary-foreground': `${h} 58% 25%`,
    '--muted': `${h} 15% 96%`,
    '--muted-foreground': `${h} 10% 45%`,
    '--accent': `${h} 40% 90%`,
    '--accent-foreground': `${h} 58% 25%`,
    '--destructive': '0 72% 51%',
    '--destructive-foreground': '0 0% 100%',
    '--border': `${h} 15% 90%`,
    '--input': `${h} 15% 90%`,
    '--ring': `${h} 58% 39%`,
    '--radius': '0.625rem',
    '--sidebar-background': `${h} 15% 100%`,
    '--sidebar-foreground': `${h} 30% 15%`,
    '--sidebar-primary': `${h} 58% 39%`,
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': `${h} 30% 95%`,
    '--sidebar-accent-foreground': `${h} 58% 25%`,
    '--sidebar-border': `${h} 15% 92%`,
    '--sidebar-ring': `${h} 58% 39%`,
    '--success': '142 76% 36%',
    '--success-foreground': '0 0% 100%',
    '--warning': '45 93% 47%',
    '--warning-foreground': '0 0% 0%',
    '--info': '199 89% 48%',
    '--info-foreground': '0 0% 100%',
  };
}

/** Mesma estrutura de tokens que .dark em index.css — apenas valores de cor derivados da COR_BASE */
export function buildAuraDarkVars(): Record<string, string> {
  return {
    '--background': `${h} 25% 8%`,
    '--foreground': '0 0% 95%',
    '--card': `${h} 25% 10%`,
    '--card-foreground': '0 0% 95%',
    '--popover': `${h} 25% 10%`,
    '--popover-foreground': '0 0% 95%',
    '--primary': `${h} 58% 45%`,
    '--primary-foreground': `${h} 25% 8%`,
    '--secondary': `${h} 20% 15%`,
    '--secondary-foreground': '0 0% 95%',
    '--muted': `${h} 20% 15%`,
    '--muted-foreground': `${h} 10% 60%`,
    '--accent': `${h} 20% 18%`,
    '--accent-foreground': '0 0% 95%',
    '--destructive': '0 72% 51%',
    '--destructive-foreground': '0 0% 100%',
    '--border': `${h} 20% 18%`,
    '--input': `${h} 20% 18%`,
    '--ring': `${h} 58% 45%`,
    '--radius': '0.625rem',
    '--sidebar-background': `${h} 25% 10%`,
    '--sidebar-foreground': '0 0% 95%',
    '--sidebar-primary': `${h} 58% 45%`,
    '--sidebar-primary-foreground': `${h} 25% 8%`,
    '--sidebar-accent': `${h} 20% 15%`,
    '--sidebar-accent-foreground': '0 0% 95%',
    '--sidebar-border': `${h} 20% 18%`,
    '--sidebar-ring': `${h} 58% 45%`,
    '--success': '142 76% 42%',
    '--warning': '45 93% 52%',
    '--info': '199 89% 54%',
  };
}

/** Gera o CSS para [data-theme="aura-light"] e [data-theme="aura-dark"] */
export function getAuraThemeCSS(): string {
  const light = buildAuraLightVars();
  const dark = buildAuraDarkVars();
  const toDeclarations = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
  return `[data-theme="aura-light"] {\n${toDeclarations(light)}\n}\n[data-theme="aura-dark"] {\n${toDeclarations(dark)}\n}`;
}

const STYLE_ID = 'theme-aura-styles';

/** Injeta ou atualiza o bloco de estilos do tema Aura no documento. Chamar uma vez na inicialização. */
export function injectAuraThemeStyles(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = getAuraThemeCSS();
}
