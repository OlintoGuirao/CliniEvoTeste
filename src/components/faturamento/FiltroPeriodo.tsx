import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type PeriodoPreset = 'hoje' | '7dias' | 'mes' | 'ano' | 'personalizado';

export interface FiltroPeriodoValue {
  preset: PeriodoPreset;
  dataInicio: string;
  dataFim: string;
}

interface FiltroPeriodoProps {
  value: FiltroPeriodoValue;
  onChange: (v: FiltroPeriodoValue) => void;
  className?: string;
}

export function FiltroPeriodo({ value, onChange, className }: FiltroPeriodoProps) {
  const setPreset = (preset: PeriodoPreset, dataInicio: string, dataFim: string) => {
    onChange({ preset, dataInicio, dataFim });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Label className="text-sm font-medium">Período</Label>
      <RadioGroup
        value={value.preset}
        onValueChange={(v) => {
          const preset = v as PeriodoPreset;
          const today = new Date().toISOString().slice(0, 10);
          if (preset === 'hoje') setPreset('hoje', today, today);
          else if (preset === '7dias') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            setPreset('7dias', d.toISOString().slice(0, 10), today);
          }           else if (preset === 'mes') {
            const d = new Date();
            const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
            setPreset('mes', start, end);
          } else if (preset === 'ano') {
            const d = new Date();
            const start = new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
            const end = new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10);
            setPreset('ano', start, end);
          } else {
            onChange({ ...value, preset: 'personalizado' });
          }
        }}
        className="flex flex-wrap gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="hoje" id="periodo-hoje" />
          <Label htmlFor="periodo-hoje" className="font-normal cursor-pointer">Hoje</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="7dias" id="periodo-7dias" />
          <Label htmlFor="periodo-7dias" className="font-normal cursor-pointer">Últimos 7 dias</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="mes" id="periodo-mes" />
          <Label htmlFor="periodo-mes" className="font-normal cursor-pointer">Mês atual</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="ano" id="periodo-ano" />
          <Label htmlFor="periodo-ano" className="font-normal cursor-pointer">Ano atual</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="personalizado" id="periodo-personalizado" />
          <Label htmlFor="periodo-personalizado" className="font-normal cursor-pointer">Personalizado</Label>
        </div>
      </RadioGroup>
      {value.preset === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="data-inicio" className="text-xs">Data início</Label>
            <Input
              id="data-inicio"
              type="date"
              value={value.dataInicio}
              onChange={(e) => onChange({ ...value, dataInicio: e.target.value })}
              className="w-[140px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-fim" className="text-xs">Data fim</Label>
            <Input
              id="data-fim"
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
