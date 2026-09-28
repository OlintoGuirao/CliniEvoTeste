import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export interface TreatmentDetailHeaderProps {
  /** Link para voltar (ex: "/weight-loss", "/botox") */
  backHref: string;
  /** Título principal (ex: "Programa de Emagrecimento", "Aplicação de Botox") */
  title: string;
  /** Subtítulo opcional (ex: nome do paciente, data) */
  subtitle?: string;
  /** Exibir botão voltar (default: true) */
  showBackLink?: boolean;
  /** Ação à direita no desktop (ex: botão Editar ou Nova sessão). No mobile fica abaixo do header. */
  rightAction?: React.ReactNode;
}

/**
 * Header padronizado para páginas de detalhe de tratamento.
 * Mobile: botão voltar dentro do card do título (canto esquerdo).
 * Desktop: botão voltar ao lado do card.
 */
export function TreatmentDetailHeader({
  backHref,
  title,
  subtitle,
  showBackLink = true,
  rightAction,
}: TreatmentDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
        {showBackLink && (
          <Button variant="ghost" size="icon" className="hidden md:inline-flex shrink-0" asChild>
            <Link to={backHref}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
        )}
        <div className="relative flex-1 min-w-0 rounded-xl bg-primary/10 py-4 px-4 border border-primary/20">
          {showBackLink && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 shrink-0"
              asChild
            >
              <Link to={backHref} className="inline-flex">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          )}
          <div className={showBackLink ? 'text-center pl-10 md:pl-0' : 'text-center'}>
            <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-primary break-words line-clamp-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground mt-1 text-xs md:text-sm break-words line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {rightAction && (
        <div className="shrink-0 w-full md:w-auto">{rightAction}</div>
      )}
    </div>
  );
}
