import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Cores do tema "Minimalista Moderna com Foco Cirúrgico" */
const THEME = {
  background: '#FAFAF8',
  textPrimary: '#1A1A1A',
  antes: '#10B981',
  depois: '#0F3A7D',
  cta: '#F59E0B',
  ctaHover: '#D97706',
  border: 'rgba(26, 26, 26, 0.08)',
  white: '#FFFFFF',
} as const;

export interface AntesDepoisCardProps {
  /** URL da imagem "Antes" (principal) */
  beforeImageUrl: string | null;
  /** URL da imagem "Depois" (principal) */
  afterImageUrl: string | null;
  /** URLs para a seção "Área Tratada" (zoom). Se não informado, usa beforeImageUrl/afterImageUrl */
  zoomBeforeUrl?: string | null;
  zoomAfterUrl?: string | null;
  /** Título da área tratada (ex: "Área Tratada") */
  areaTreatedTitle?: string;
  /** Descrição do tratamento (ex: "Microblading de sobrancelhas e tratamento de pele...") */
  areaTreatedDescription?: string;
  /** Texto do CTA (ex: "Transforme sua autoestima com um plano personalizado.") */
  ctaText?: string;
  /** Texto do botão CTA (ex: "AGENDE SUA AVALIAÇÃO") */
  ctaButtonText?: string;
  /** Callback ao clicar no CTA (opcional; se não informado, o botão não é exibido) */
  onCtaClick?: () => void;
  /** Mostrar header com branding CLINIEVO */
  showHeader?: boolean;
  /** Descrição sob a imagem Antes */
  beforeDescription?: string;
  /** Descrição sob a imagem Depois */
  afterDescription?: string;
  className?: string;
}

export function AntesDepoisCard({
  beforeImageUrl,
  afterImageUrl,
  zoomBeforeUrl,
  zoomAfterUrl,
  areaTreatedTitle = 'Área Tratada',
  areaTreatedDescription = 'Comparação detalhada antes e depois do tratamento estético.',
  ctaText = 'Transforme sua autoestima com um plano personalizado.',
  ctaButtonText = 'AGENDE SUA AVALIAÇÃO',
  onCtaClick,
  showHeader = true,
  beforeDescription = 'Estado natural da pele e sobrancelhas',
  afterDescription = 'Resultado após tratamento estético',
  className,
}: AntesDepoisCardProps) {
  const zoomBefore = zoomBeforeUrl ?? beforeImageUrl;
  const zoomAfter = zoomAfterUrl ?? afterImageUrl;
  const [hoverAntes, setHoverAntes] = React.useState(false);
  const [hoverDepois, setHoverDepois] = React.useState(false);

  return (
    <article
      className={cn('overflow-hidden rounded-xl', className)}
      style={{
        backgroundColor: THEME.background,
        color: THEME.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      role="article"
      aria-label="Resultado da sessão - Antes e Depois"
    >
      {/* 1. Header */}
      {showHeader && (
        <header
          className="border-b px-6 py-6 md:px-8 md:py-8"
          style={{ borderColor: THEME.border, backgroundColor: THEME.white }}
        >
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase opacity-70"
            style={{ fontFamily: "'Poppins', sans-serif", color: THEME.textPrimary }}
          >
            CLINIEVO
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight md:text-[28px]"
            style={{ fontFamily: "'Poppins', sans-serif", color: THEME.textPrimary }}
          >
            RESULTADO DA SESSÃO
          </h2>
          <p className="mt-1 text-sm opacity-80" style={{ fontSize: '14px', color: THEME.textPrimary }}>
            Antes e depois do tratamento estético
          </p>
        </header>
      )}

      {/* 2. Comparação principal — grid 3 colunas (mobile: 1 col) */}
      <div className="grid grid-cols-1 gap-6 px-6 py-8 md:gap-8 md:px-8 md:py-10 lg:grid-cols-3 lg:gap-10">
        {/* Coluna 1 — Antes (menor) */}
        <div
          className="flex flex-col gap-4 opacity-0"
          style={{ animation: 'fadeIn 0.3s ease-out 0ms both' }}
        >
          <span
            className="inline-flex w-fit rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white"
            style={{ backgroundColor: THEME.antes, fontFamily: "'Poppins', sans-serif" }}
          >
            Antes
          </span>
          <div className="relative aspect-[4/5] max-w-[280px] overflow-hidden rounded-xl shadow-md lg:max-w-full">
            {beforeImageUrl ? (
              <img
                src={beforeImageUrl}
                alt="Estado antes do tratamento"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-sm opacity-60"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
              >
                Sem foto
              </div>
            )}
            {/* Círculo interativo */}
            <div
              className="absolute right-3 top-3 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-white/90 transition-all duration-300 ease-out"
              style={{
                borderColor: THEME.antes,
                boxShadow: hoverAntes ? `0 0 24px ${THEME.antes}40` : '0 2px 8px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={() => setHoverAntes(true)}
              onMouseLeave={() => setHoverAntes(false)}
              role="img"
              aria-hidden
            />
          </div>
          <p className="text-sm leading-relaxed opacity-90" style={{ fontSize: '14px' }}>
            {beforeDescription}
          </p>
        </div>

        {/* Coluna 2 — Zoom / Área Tratada (centro) */}
        <div
          className="flex flex-col gap-4 rounded-xl px-5 py-6 opacity-0 md:px-6 md:py-8"
          style={{
            background: `linear-gradient(135deg, ${THEME.antes}18 0%, ${THEME.depois}18 100%)`,
            animation: 'fadeIn 0.3s ease-out 100ms both',
          }}
        >
          <h3
            className="text-lg font-bold tracking-tight md:text-xl"
            style={{ fontFamily: "'Poppins', sans-serif", color: THEME.textPrimary }}
          >
            {areaTreatedTitle}
          </h3>
          <p className="text-sm leading-relaxed opacity-90" style={{ fontSize: '14px' }}>
            {areaTreatedDescription}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-lg border-2 shadow-sm" style={{ borderColor: THEME.antes }}>
              {zoomBefore ? (
                <img
                  src={zoomBefore}
                  alt="Detalhe antes"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="flex aspect-square w-full items-center justify-center text-xs opacity-60"
                  style={{ backgroundColor: `${THEME.antes}15` }}
                >
                  Antes
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border-2 shadow-sm" style={{ borderColor: THEME.depois }}>
              {zoomAfter ? (
                <img
                  src={zoomAfter}
                  alt="Detalhe depois"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="flex aspect-square w-full items-center justify-center text-xs opacity-60"
                  style={{ backgroundColor: `${THEME.depois}15` }}
                >
                  Depois
                </div>
              )}
            </div>
          </div>
          {/* Seta visual (gradiente verde → azul) */}
          <div
            className="h-1 w-full rounded-full opacity-60"
            style={{ background: `linear-gradient(90deg, ${THEME.antes}, ${THEME.depois})` }}
            aria-hidden
          />
        </div>

        {/* Coluna 3 — Depois (maior) */}
        <div
          className="flex flex-col gap-4 opacity-0"
          style={{ animation: 'fadeIn 0.3s ease-out 200ms both' }}
        >
          <span
            className="inline-flex w-fit rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white"
            style={{ backgroundColor: THEME.depois, fontFamily: "'Poppins', sans-serif" }}
          >
            Depois
          </span>
          <div className="relative aspect-[4/5] max-w-[320px] overflow-hidden rounded-xl shadow-lg lg:max-w-full">
            {afterImageUrl ? (
              <img
                src={afterImageUrl}
                alt="Resultado depois do tratamento"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-sm opacity-60"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
              >
                Sem foto
              </div>
            )}
            <div
              className="absolute right-3 top-3 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-white/90 transition-all duration-300 ease-out"
              style={{
                borderColor: THEME.depois,
                boxShadow: hoverDepois ? `0 0 24px ${THEME.depois}40` : '0 2px 8px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={() => setHoverDepois(true)}
              onMouseLeave={() => setHoverDepois(false)}
              role="img"
              aria-hidden
            />
          </div>
          <p className="text-sm leading-relaxed opacity-90" style={{ fontSize: '14px' }}>
            {afterDescription}
          </p>
        </div>
      </div>

      {/* 3. CTA Section */}
      {onCtaClick != null && (
        <footer
          className="border-t px-6 py-8 md:px-8 md:py-10"
          style={{ borderColor: THEME.border, backgroundColor: THEME.white }}
        >
          <p className="mb-4 text-center text-sm leading-relaxed opacity-90" style={{ fontSize: '14px' }}>
            {ctaText}
          </p>
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={onCtaClick}
              className="rounded-full px-8 py-6 text-sm font-bold uppercase tracking-wide shadow-md transition-all duration-300 ease-out hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                fontFamily: "'Poppins', sans-serif",
                backgroundColor: THEME.cta,
                color: THEME.textPrimary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = THEME.ctaHover;
                e.currentTarget.style.color = THEME.white;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = THEME.cta;
                e.currentTarget.style.color = THEME.textPrimary;
              }}
            >
              {ctaButtonText}
            </Button>
          </div>
        </footer>
      )}
    </article>
  );
}
