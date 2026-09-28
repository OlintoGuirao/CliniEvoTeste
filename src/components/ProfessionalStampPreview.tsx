import { cn } from '@/lib/utils';

type ProfessionalStampPreviewProps = {
  signatureDataUrl: string | null | undefined;
  fullName: string;
  registryLine: string;
  titleLine?: string | null;
  className?: string;
};

/** Preview no estilo do carimbo físico: nome itálico · título · CRO-UF número. */
export function ProfessionalStampPreview({
  signatureDataUrl,
  fullName,
  registryLine,
  titleLine,
  className,
}: ProfessionalStampPreviewProps) {
  const title = titleLine?.trim() || '';

  return (
    <div
      className={cn(
        'rounded-xl border bg-white text-black px-6 py-5 flex flex-col items-center text-center shadow-sm',
        className
      )}
    >
      {signatureDataUrl ? (
        <img
          src={signatureDataUrl}
          alt="Assinatura"
          className="h-14 sm:h-16 w-auto max-w-[min(100%,260px)] object-contain"
        />
      ) : (
        <p className="h-14 sm:h-16 flex items-center justify-center text-sm text-muted-foreground italic font-serif">
          Assinatura
        </p>
      )}
      <div className="w-[min(100%,240px)] border-t border-black mt-2 mb-3" />
      <p className="font-serif italic text-base sm:text-lg font-semibold leading-snug">
        {fullName || 'Nome do profissional'}
      </p>
      {title ? (
        <p className="font-sans text-sm sm:text-[15px] leading-snug mt-1">{title}</p>
      ) : null}
      <p className="font-sans text-sm sm:text-[15px] leading-snug mt-0.5">
        {registryLine || 'CRO-UF 00000'}
      </p>
    </div>
  );
}
