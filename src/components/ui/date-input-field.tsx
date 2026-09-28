import { useEffect, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const calendarFormatters = {
  formatMonthDropdown: (date: Date) => {
    const month = format(date, 'MMMM', { locale: ptBR });
    return month.charAt(0).toUpperCase() + month.slice(1);
  },
  formatCaption: (date: Date) => {
    const month = format(date, 'MMMM', { locale: ptBR });
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${date.getFullYear()}`;
  },
};

export function maskBrDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBrDateInput(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = parse(trimmed, 'dd/MM/yyyy', new Date());
  if (!isValid(parsed)) return undefined;
  return parsed;
}

type DateInputFieldProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  inputId?: string;
  disabled?: (date: Date) => boolean;
  maxDate?: Date;
  fromYear?: number;
  toYear?: number;
  className?: string;
};

export function DateInputField({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  inputId,
  disabled,
  maxDate,
  fromYear = 1920,
  toYear = new Date().getFullYear(),
  className,
}: DateInputFieldProps) {
  const [text, setText] = useState(value ? format(value, 'dd/MM/yyyy') : '');

  useEffect(() => {
    setText(value ? format(value, 'dd/MM/yyyy') : '');
  }, [value]);

  const commitText = (raw: string) => {
    const masked = maskBrDateInput(raw);
    setText(masked);
    if (!masked) {
      onChange(undefined);
      return;
    }
    if (masked.length < 10) return;
    const parsed = parseBrDateInput(masked);
    if (!parsed) return;
    if (maxDate && parsed > maxDate) return;
    if (disabled?.(parsed)) return;
    onChange(parsed);
  };

  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        id={inputId}
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={(e) => commitText(e.target.value)}
        onBlur={() => {
          if (!text.trim()) {
            onChange(undefined);
            return;
          }
          if (text.length < 10) {
            setText(value ? format(value, 'dd/MM/yyyy') : '');
          }
        }}
        className="flex-1"
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Abrir calendário">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[1600] w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => onChange(date)}
            disabled={disabled ?? (maxDate ? (date) => date > maxDate : undefined)}
            locale={ptBR}
            weekStartsOn={0}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            labels={{ labelMonthDropdown: () => 'Mês', labelYearDropdown: () => 'Ano' }}
            formatters={calendarFormatters}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
