import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import { IMC_OBESITY_SCALE_LABELS, imcToObesityScaleIndex, type ImcObesityScaleIndex } from '@/lib/imcObesityScale';

/** Faixa horizontal 8 figuras (1024×386); cada quadro = 128px de largura. */
function imcStripUrl(sex: Database['public']['Enums']['patient_sex'] | null | undefined): string {
  const base = import.meta.env.BASE_URL;
  if (sex === 'male') return `${base}imc-body-scale-male.png`;
  if (sex === 'female') return `${base}imc-body-scale-female.png`;
  /* outro ou não informado */
  return `${base}imc-body-scale-strip.png`;
}

type Props = {
  imc: number | null;
  patientSex?: Database['public']['Enums']['patient_sex'] | null;
  className?: string;
};

export function ImcSilhouetteScale({ imc, patientSex, className }: Props) {
  const stripUrl = imcStripUrl(patientSex);
  const activeIndex: ImcObesityScaleIndex | null =
    imc != null && Number.isFinite(imc) && imc > 0 && imc < 100 ? imcToObesityScaleIndex(imc) : null;
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeIndex == null || !listRef.current || !activeItemRef.current) return;
    const list = listRef.current;
    const item = activeItemRef.current;
    const isScrollable = list.scrollWidth > list.clientWidth;
    if (!isScrollable) return;

    const itemCenter = item.offsetLeft + item.offsetWidth / 2;
    const targetLeft = Math.max(0, itemCenter - list.clientWidth / 2);
    list.scrollTo({ left: targetLeft, behavior: 'auto' });
  }, [activeIndex]);

  return (
    <div className={cn('mt-6 w-full min-w-0 max-w-full', className)}>
      <p className="mb-3 text-sm font-medium text-[#3d3d3d]">Classificação visual (IMC)</p>
      <p className="mb-4 text-xs text-[#5a5a5a]">
        O quadro destacado em verde corresponde à faixa do IMC atual. Sobrepeso dividido em três níveis; obesidade nos graus I, II e III.
      </p>
      <div
        ref={listRef}
        className="flex w-full min-w-0 max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible sm:snap-none lg:grid-cols-8 [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Escala de classificação por IMC"
      >
        {IMC_OBESITY_SCALE_LABELS.map((label, index) => {
          const level = index as ImcObesityScaleIndex;
          const selected = activeIndex === level;
          return (
            <div
              key={label}
              ref={selected ? activeItemRef : undefined}
              role="listitem"
              className={cn(
                'flex min-w-[4.25rem] shrink-0 snap-start flex-col rounded-xl border-2 p-1 transition-colors sm:min-w-0 sm:snap-none',
                selected
                  ? 'border-emerald-600 bg-emerald-50 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/35'
                  : 'border-black/[0.06] bg-white dark:border-border dark:bg-card/50'
              )}
              aria-current={selected ? 'true' : undefined}
            >
              <span className="sr-only">{label}</span>
              <div
                className="w-full max-w-full bg-no-repeat [background-size:800%_100%]"
                style={{
                  aspectRatio: '128 / 386',
                  backgroundImage: `url(${stripUrl})`,
                  backgroundPosition: `${(100 * level) / 7}% center`,
                }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
      {activeIndex == null ? (
        <p className="mt-3 text-xs text-muted-foreground">Informe peso e altura válidos para marcar a faixa na escala.</p>
      ) : null}
    </div>
  );
}
