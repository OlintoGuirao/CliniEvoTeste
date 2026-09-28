import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { periodFromPreset, type MasterDashboardPeriodPreset } from '@/lib/clinicMasterDashboardMetrics';

export type { MasterDashboardPeriodPreset };

export interface MasterDashboardPeriodValue {
  preset: MasterDashboardPeriodPreset;
  dataInicio: string;
  dataFim: string;
}

interface MasterDashboardPeriodFilterProps {
  value: MasterDashboardPeriodValue;
  onChange: (v: MasterDashboardPeriodValue) => void;
  className?: string;
}

export function MasterDashboardPeriodFilter({ value, onChange, className }: MasterDashboardPeriodFilterProps) {
  const applyPreset = (preset: MasterDashboardPeriodPreset) => {
    if (preset === 'personalizado') {
      onChange({ ...value, preset });
      return;
    }
    const range = periodFromPreset(preset);
    onChange({ preset, ...range });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-sm font-medium">Período</Label>
      <RadioGroup
        value={value.preset}
        onValueChange={(v) => applyPreset(v as MasterDashboardPeriodPreset)}
        className="flex flex-wrap gap-3"
      >
        {(
          [
            ['hoje', 'Hoje'],
            ['semana', 'Esta semana'],
            ['mes', 'Este mês'],
            ['6meses', 'Últimos 6 meses'],
            ['personalizado', 'Personalizado'],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="flex items-center space-x-2">
            <RadioGroupItem value={id} id={`master-period-${id}`} />
            <Label htmlFor={`master-period-${id}`} className="font-normal cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {value.preset === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="master-data-inicio" className="text-xs">
              Data início
            </Label>
            <Input
              id="master-data-inicio"
              type="date"
              value={value.dataInicio}
              onChange={(e) => onChange({ ...value, dataInicio: e.target.value })}
              className="w-[140px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="master-data-fim" className="text-xs">
              Data fim
            </Label>
            <Input
              id="master-data-fim"
              type="date"
              value={value.dataFim}
              onChange={(e) => onChange({ ...value, dataFim: e.target.value })}
              className="w-[140px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function defaultMasterPeriod(): MasterDashboardPeriodValue {
  const range = periodFromPreset('mes');
  return { preset: 'mes', ...range };
}
