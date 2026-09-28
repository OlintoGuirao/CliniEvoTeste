import { Copy, Grid2x2, Stethoscope, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type OdontogramQuickActionsProps = {
  disabled?: boolean;
  canDuplicate?: boolean;
  /** Esconde títulos internos (quando o pai já rotula a seção). */
  hideSectionTitles?: boolean;
  showFaces?: boolean;
  onToggleFaces?: () => void;
  facesDisabled?: boolean;
  onChangeCondition: () => void;
  onMarkAbsent: () => void;
  onDuplicateProcedure: () => void;
  className?: string;
};

const chip =
  'h-6 shrink-0 rounded-md px-1.5 text-[10px] font-medium gap-0.5 [&_svg]:h-2.5 [&_svg]:w-2.5';

export function OdontogramQuickActions({
  disabled,
  canDuplicate,
  hideSectionTitles,
  showFaces,
  onToggleFaces,
  facesDisabled,
  onChangeCondition,
  onMarkAbsent,
  onDuplicateProcedure,
  className,
}: OdontogramQuickActionsProps) {
  return (
    <div className={cn(className)}>
      {!hideSectionTitles ? (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ações rápidas
        </p>
      ) : null}
      <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto pb-0.5">
        <Button
          type="button"
          variant="outline"
          className={cn(chip, 'border-[color:var(--odontograma-selected-border)]')}
          disabled={disabled}
          title="Alterar situação clínica"
          onClick={onChangeCondition}
        >
          <Stethoscope />
          Situação
        </Button>
        <Button
          type="button"
          variant="outline"
          className={chip}
          disabled={disabled}
          title="Marcar como ausente"
          onClick={onMarkAbsent}
        >
          <XCircle />
          Ausente
        </Button>
        <Button
          type="button"
          variant="outline"
          className={chip}
          disabled={disabled || !canDuplicate}
          title={
            canDuplicate
              ? 'Duplica o último procedimento nestes dentes'
              : 'Nenhum procedimento nestes dentes para duplicar'
          }
          onClick={onDuplicateProcedure}
        >
          <Copy />
          Duplicar
        </Button>
        {onToggleFaces ? (
          <Button
            type="button"
            variant={showFaces ? 'default' : 'outline'}
            className={cn(
              chip,
              showFaces &&
                'bg-[color:var(--odontograma-selected)] text-white hover:bg-[color:var(--odontograma-selected)]/90'
            )}
            disabled={disabled || facesDisabled}
            title={showFaces ? 'Ocultar faces' : 'Mostrar faces'}
            onClick={onToggleFaces}
          >
            <Grid2x2 />
            Faces
          </Button>
        ) : null}
      </div>
    </div>
  );
}
