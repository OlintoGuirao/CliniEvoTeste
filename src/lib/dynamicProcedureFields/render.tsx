import type { Database } from '@/integrations/supabase/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhotoUploadField } from '@/components/PhotoUploadField';

type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

type RenderParams = {
  field: ProcedureFieldRow;
  value: unknown;
  labelOverride?: string;
  optionsOverride?: string[];
  sessionDate: string;
  userId: string;
  instanceIdOrTemp: string;
  previewVisible?: boolean;
  readOnly?: boolean;
  onChange: (key: string, value: unknown) => void;
  onCameraOpen?: () => void;
  onCameraClose?: () => void;
  onImagePreviewVisibleChange?: (value: boolean) => void;
};

export function renderDynamicProcedureField({
  field,
  value,
  labelOverride,
  optionsOverride,
  sessionDate,
  userId,
  instanceIdOrTemp,
  previewVisible,
  readOnly = false,
  onChange,
  onCameraOpen,
  onCameraClose,
}: RenderParams) {
  const key = field.field_key;
  const label = labelOverride ?? field.label;
  const type = field.field_type;
  const options = optionsOverride ?? ((field.options as string[]) ?? []);

  if (type === 'text') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={label}
          className="rounded-xl h-11 sm:h-10"
          disabled={readOnly}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (type === 'number') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(key, e.target.value === '' ? null : Number(e.target.value))}
          placeholder={label}
          className="rounded-xl h-11 sm:h-10"
          disabled={readOnly}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (type === 'date') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="date"
          value={((value as string) ?? sessionDate).slice(0, 10)}
          onChange={(e) => onChange(key, e.target.value || null)}
          className="rounded-xl h-11 sm:h-10"
          disabled={readOnly}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (type === 'boolean') {
    return (
      <div key={field.id} className="flex items-center gap-2">
        <Checkbox
          id={key}
          checked={!!value}
          onCheckedChange={(c) => onChange(key, !!c)}
          disabled={readOnly}
        />
        <Label htmlFor={key}>{label}</Label>
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Select value={(value as string) ?? ''} onValueChange={(v) => onChange(key, v)} disabled={readOnly}>
          <SelectTrigger className="rounded-xl h-11 sm:h-10">
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'select_multi') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${key}-${opt}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    const on = !!c;
                    const next = on ? [...selected, opt] : selected.filter((v) => v !== opt);
                    onChange(key, next);
                  }}
                  disabled={readOnly}
                />
                <Label htmlFor={`${key}-${opt}`}>{opt}</Label>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div key={field.id} className="md:max-w-[200px] md:mx-auto">
        <PhotoUploadField
          label={label}
          value={(value as string) ?? null}
          onChange={(url) => onChange(key, url ?? '')}
          userId={userId}
          instanceIdOrTemp={`${instanceIdOrTemp}-${key}`}
          disabled={readOnly || !userId}
          compact
          onCameraOpen={onCameraOpen}
          onCameraClose={onCameraClose}
          previewVisible={previewVisible ?? true}
        />
      </div>
    );
  }

  return (
    <div key={field.id} className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={(value as string) ?? ''}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={label}
        className="rounded-xl h-11 sm:h-10"
        disabled={readOnly}
        readOnly={readOnly}
      />
    </div>
  );
}

