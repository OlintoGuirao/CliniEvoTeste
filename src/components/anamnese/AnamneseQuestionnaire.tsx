import { useEffect, useState, type ReactNode } from 'react';
import { PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn, parseLocalDate } from '@/lib/utils';
import { SignaturePad } from '@/components/SignaturePad';
import type { AnamneseData } from '@/components/anamnese/anamneseTypes';

export const PERGUNTAS: { key: keyof AnamneseData; label: string; simQual?: string }[] = [
  { key: 'q01', label: 'Já fez algum tipo de tratamento estético?', simQual: 'Qual? (Toxina Botulínica, Preenchimento, Outro)' },
  { key: 'q02', label: 'Tem alergia a algum medicamento?', simQual: 'Qual?' },
  { key: 'q03', label: 'Faz uso de algum medicamento?', simQual: 'Qual?' },
  { key: 'q04', label: 'Você é ou já foi fumante?', simQual: 'Quanto tempo?/Obs.' },
  { key: 'q05', label: 'Utiliza ou já utilizou ácido na pele?', simQual: 'Qual?' },
  { key: 'q06', label: 'Está sob algum tipo de tratamento médico?', simQual: 'Qual?/Obs.' },
  { key: 'q09', label: 'Possui muita exposição ao Sol?', simQual: 'Obs.' },
  { key: 'q10', label: 'Já teve algum tipo de câncer?', simQual: 'Qual?' },
  { key: 'q11', label: 'Possui algum tipo de cuidado estético?', simQual: 'Qual?' },
];

export const SIM_NAO_EXTRA: { key: keyof AnamneseData; label: string }[] = [
  { key: 'q12', label: 'Possui intolerância à lactose?' },
  { key: 'q13', label: 'Tem diabetes?' },
  { key: 'q14', label: 'Possui alergia à proteína do ovo (Albumina)?' },
];

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm">
      {value || '—'}
    </div>
  );
}

function SimNaoOptions({
  value,
  disabled,
  onNaoChange,
  onSimChange,
}: {
  value?: 'sim' | 'nao';
  disabled?: boolean;
  onNaoChange?: (checked: boolean) => void;
  onSimChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className={cn('flex items-center gap-2', !disabled && 'cursor-pointer')}>
        <Checkbox checked={value === 'nao'} disabled={disabled} onCheckedChange={onNaoChange} />
        <span className="text-sm">Não</span>
      </label>
      <label className={cn('flex items-center gap-2', !disabled && 'cursor-pointer')}>
        <Checkbox checked={value === 'sim'} disabled={disabled} onCheckedChange={onSimChange} />
        <span className="text-sm">Sim</span>
      </label>
    </div>
  );
}

function QuestionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

export function getSimDetail(data: AnamneseData, key: keyof AnamneseData): string | undefined {
  if (data[key] !== 'sim') return undefined;
  if (key === 'q01') {
    const parts = [data.q01_qual, data.q01_detalhes].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }
  return data[`${key}_qual` as keyof AnamneseData] as string | undefined;
}

type AnamneseQuestionnaireProps = {
  data: AnamneseData;
  savedData: AnamneseData;
  isEditing: boolean;
  onUpdate: (key: keyof AnamneseData, value: string | undefined) => void;
  signatureData: string | null;
  signedAt: string | null;
  onSaveSignature?: (dataUrl: string) => void;
  showSignatureSection?: boolean;
};

export function AnamneseQuestionnaire({
  data,
  savedData,
  isEditing,
  onUpdate,
  signatureData,
  signedAt,
  onSaveSignature,
  showSignatureSection = true,
}: AnamneseQuestionnaireProps) {
  const display = isEditing ? data : savedData;
  const [isResigning, setIsResigning] = useState(false);

  useEffect(() => {
    if (!isEditing) setIsResigning(false);
  }, [isEditing]);

  const hasSignature = Boolean(signedAt && signatureData);
  const showSignaturePad = isEditing && Boolean(onSaveSignature) && (!hasSignature || isResigning);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Sim/Não e detalhe quando necessário.</p>

      {PERGUNTAS.map(({ key, label, simQual }) => {
        const value = display[key] as 'sim' | 'nao' | undefined;
        const detail = getSimDetail(display, key);

        return (
          <QuestionCard key={key} label={label}>
            <SimNaoOptions
              value={value}
              disabled={!isEditing}
              onNaoChange={isEditing ? (checked) => onUpdate(key, checked ? 'nao' : undefined) : undefined}
              onSimChange={isEditing ? (checked) => onUpdate(key, checked ? 'sim' : undefined) : undefined}
            />
            {isEditing && value === 'sim' && simQual ? (
              <Input
                className="max-w-xs"
                placeholder={simQual}
                value={data[`${key}_qual` as keyof AnamneseData] ?? ''}
                onChange={(e) => onUpdate(`${key}_qual` as keyof AnamneseData, e.target.value)}
              />
            ) : null}
            {isEditing && key === 'q01' && data.q01 === 'sim' ? (
              <Input
                className="mt-2 max-w-md"
                placeholder="Detalhes da aplicação"
                value={data.q01_detalhes ?? ''}
                onChange={(e) => onUpdate('q01_detalhes', e.target.value)}
              />
            ) : null}
            {!isEditing && detail ? (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-medium text-muted-foreground">Detalhes</Label>
                <ReadOnlyField value={detail} />
              </div>
            ) : null}
          </QuestionCard>
        );
      })}

      <QuestionCard label="Está gestante?">
        <SimNaoOptions
          value={display.q07_gestante}
          disabled={!isEditing}
          onNaoChange={
            isEditing ? (checked) => onUpdate('q07_gestante', checked ? 'nao' : undefined) : undefined
          }
          onSimChange={
            isEditing ? (checked) => onUpdate('q07_gestante', checked ? 'sim' : undefined) : undefined
          }
        />
      </QuestionCard>

      <QuestionCard label="Possui filhos?">
        <SimNaoOptions
          value={display.q07_filhos}
          disabled={!isEditing}
          onNaoChange={
            isEditing ? (checked) => onUpdate('q07_filhos', checked ? 'nao' : undefined) : undefined
          }
          onSimChange={
            isEditing ? (checked) => onUpdate('q07_filhos', checked ? 'sim' : undefined) : undefined
          }
        />
      </QuestionCard>

      <QuestionCard label="Quanto costuma ser sua pressão arterial?">
        {isEditing ? (
          <Input
            value={data.q08_pressao ?? ''}
            onChange={(e) => onUpdate('q08_pressao', e.target.value)}
            placeholder="Ex: 12x8"
          />
        ) : (
          <ReadOnlyField value={savedData.q08_pressao ?? ''} />
        )}
      </QuestionCard>

      <QuestionCard label="Possui algum problema de coração?">
        <SimNaoOptions
          value={display.q08_coracao}
          disabled={!isEditing}
          onNaoChange={
            isEditing ? (checked) => onUpdate('q08_coracao', checked ? 'nao' : undefined) : undefined
          }
          onSimChange={
            isEditing ? (checked) => onUpdate('q08_coracao', checked ? 'sim' : undefined) : undefined
          }
        />
        {isEditing && data.q08_coracao === 'sim' ? (
          <Input
            className="max-w-xs"
            placeholder="Qual?"
            value={data.q08_qual ?? ''}
            onChange={(e) => onUpdate('q08_qual', e.target.value)}
          />
        ) : null}
        {!isEditing && savedData.q08_coracao === 'sim' && savedData.q08_qual ? (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-medium text-muted-foreground">Detalhes</Label>
            <ReadOnlyField value={savedData.q08_qual} />
          </div>
        ) : null}
      </QuestionCard>

      {SIM_NAO_EXTRA.map(({ key, label }) => (
        <QuestionCard key={key} label={label}>
          <SimNaoOptions
            value={display[key] as 'sim' | 'nao' | undefined}
            disabled={!isEditing}
            onNaoChange={isEditing ? (checked) => onUpdate(key, checked ? 'nao' : undefined) : undefined}
            onSimChange={isEditing ? (checked) => onUpdate(key, checked ? 'sim' : undefined) : undefined}
          />
        </QuestionCard>
      ))}

      <div className="space-y-2">
        <Label>Observações</Label>
        {isEditing ? (
          <Textarea
            value={data.observacoes ?? ''}
            onChange={(e) => onUpdate('observacoes', e.target.value)}
            className="min-h-[100px]"
            placeholder="Anotações gerais"
          />
        ) : savedData.observacoes ? (
          <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm whitespace-pre-wrap">
            {savedData.observacoes}
          </div>
        ) : (
          <ReadOnlyField value="" />
        )}
      </div>

      {showSignatureSection ? (
        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
          <Label className="text-sm font-medium">Termo de responsabilidade</Label>
          <p className="text-xs text-muted-foreground">Ciente e de acordo com as informações acima.</p>
          {hasSignature && !showSignaturePad ? (
            <div className="rounded-lg border border-border/50 bg-background/60 p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Assinado em {parseLocalDate(signedAt!).toLocaleDateString('pt-BR')}.
              </p>
              <img src={signatureData!} alt="Assinatura" className="max-h-20 border rounded bg-muted/30" />
              {isEditing && onSaveSignature ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg"
                  onClick={() => setIsResigning(true)}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Reassinar
                </Button>
              ) : null}
            </div>
          ) : showSignaturePad ? (
            <div className="space-y-2">
              {hasSignature ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    onClick={() => setIsResigning(false)}
                  >
                    Manter assinatura atual
                  </Button>
                </div>
              ) : null}
              <SignaturePad
                onSave={(dataUrl) => {
                  setIsResigning(false);
                  onSaveSignature?.(dataUrl);
                }}
                height={180}
              />
            </div>
          ) : (
            <ReadOnlyField value="Não assinado" />
          )}
        </div>
      ) : null}
    </div>
  );
}
