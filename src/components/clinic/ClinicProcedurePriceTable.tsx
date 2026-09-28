import { Input } from '@/components/ui/input';
import {
  CLINIC_PRICE_TIER_FIELDS,
  CLINIC_PRICE_TIER_LABELS,
  CLINIC_PRICE_TIERS,
  normalizeClinicPriceFields,
  type ClinicPriceFieldsInput,
} from '@/lib/clinicPriceTiers';

type ClinicProcedurePriceTableProps = {
  values: ClinicPriceFieldsInput;
  idPrefix: string;
  onChange: (key: keyof ClinicPriceFieldsInput, value: string) => void;
  disabled?: boolean;
};

export function ClinicProcedurePriceTable({
  values,
  idPrefix,
  onChange,
  disabled,
}: ClinicProcedurePriceTableProps) {
  const normalized = normalizeClinicPriceFields(values);

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {CLINIC_PRICE_TIERS.map((tier) => (
              <th
                key={tier}
                className="px-2 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
              >
                {CLINIC_PRICE_TIER_LABELS[tier]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {CLINIC_PRICE_TIERS.map((tier) => {
              const field = CLINIC_PRICE_TIER_FIELDS[tier];
              return (
                <td key={tier} className="p-2 align-top">
                  <Input
                    id={`${idPrefix}-${field}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={normalized[field]}
                    disabled={disabled}
                    onChange={(e) => onChange(field, e.target.value)}
                    className="h-9 min-w-[88px] text-sm tabular-nums"
                  />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
