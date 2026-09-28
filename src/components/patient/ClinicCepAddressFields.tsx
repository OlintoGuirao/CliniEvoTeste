import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cepDigits, formatCepDisplay, isCompleteCep, lookupCep } from '@/lib/viaCep';

export type ClinicAddressFormValue = {
  zip_code: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
};

type ClinicCepAddressFieldsProps = {
  value: ClinicAddressFormValue;
  onChange: (next: ClinicAddressFormValue) => void;
  idPrefix?: string;
};

export function ClinicCepAddressFields({
  value,
  onChange,
  idPrefix = '',
}: ClinicCepAddressFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';
  const numberRef = useRef<HTMLInputElement>(null);
  const lastLookedUp = useRef('');
  const valueRef = useRef(value);
  valueRef.current = value;
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    const digits = cepDigits(value.zip_code);
    if (!isCompleteCep(digits)) {
      setLookingUp(false);
      return;
    }
    if (digits === lastLookedUp.current) return;

    const controller = new AbortController();
    lastLookedUp.current = digits;
    setLookingUp(true);

    void lookupCep(digits, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result) {
          toast.error('CEP não encontrado. Confira o número ou preencha o endereço manualmente.');
          return;
        }
        const current = valueRef.current;
        onChange({
          ...current,
          zip_code: formatCepDisplay(result.zipCode),
          address: result.street || current.address,
          neighborhood: result.neighborhood || current.neighborhood,
          city: result.city || current.city,
        });
        window.setTimeout(() => numberRef.current?.focus(), 0);
      })
      .catch((error: unknown) => {
        const aborted =
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError');
        if (aborted) return;
        lastLookedUp.current = '';
        toast.error('Não foi possível consultar o CEP. Tente novamente.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookingUp(false);
      });

    return () => controller.abort();
    // value is read at request time; re-run only when CEP digits change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.zip_code]);

  function patch(partial: Partial<ClinicAddressFormValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}zip_code`}>CEP</Label>
        <div className="relative">
          <Input
            id={`${prefix}zip_code`}
            inputMode="numeric"
            autoComplete="postal-code"
            value={formatCepDisplay(value.zip_code)}
            onChange={(e) => {
              const next = formatCepDisplay(e.target.value);
              if (cepDigits(next) !== lastLookedUp.current) lastLookedUp.current = '';
              patch({ zip_code: next });
            }}
            placeholder="00000-000"
            className="pr-9"
          />
          {lookingUp ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Digite o CEP para preencher endereço, bairro e cidade.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}address_number`}>Número</Label>
        <Input
          ref={numberRef}
          id={`${prefix}address_number`}
          inputMode="numeric"
          value={value.address_number}
          onChange={(e) => patch({ address_number: e.target.value })}
          placeholder="Nº"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}address`}>Endereço</Label>
        <Input
          id={`${prefix}address`}
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="Rua, avenida..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}neighborhood`}>Bairro</Label>
        <Input
          id={`${prefix}neighborhood`}
          value={value.neighborhood}
          onChange={(e) => patch({ neighborhood: e.target.value })}
          placeholder="Bairro"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}city`}>Cidade</Label>
        <Input
          id={`${prefix}city`}
          value={value.city}
          onChange={(e) => patch({ city: e.target.value })}
          placeholder="Cidade"
        />
      </div>
    </>
  );
}
