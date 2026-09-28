import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Bell,
  CalendarPlus,
  ChevronDown,
  ImageIcon,
  Stethoscope,
} from 'lucide-react';
import type { ProcedureFieldWithSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import { renderDynamicProcedureField } from '@/lib/dynamicProcedureFields/render';
import {
  isLegacyBeforeAfterImageField,
  isProcedureFieldFullWidthOnDesktop,
  PEIM_LABEL_OVERRIDES,
  PEIM_OPTIONS_OVERRIDES,
  PROCEDURE_SLUGS_WITH_FACIAL_MAP,
} from '@/lib/dynamicProcedureFields/consultationFieldLayout';
import {
  createEmptyPreenchimentoAplicacaoItem,
  getPreenchimentoAplicacoesForForm,
  isPreenchimentoRepeatableFieldKey,
} from '@/lib/preenchimentoFacial';
import {
  createEmptyLipoenzimaticaProdutoItem,
  getLipoenzimaticaAreasForForm,
  getLipoenzimaticaProdutosForForm,
  isLipoenzimaticaHiddenFieldKey,
  LIPOENZIMATICA_SLUG,
} from '@/lib/lipoenzimatica';
import { BeforeAfterGalleryCard } from '@/components/consultation/BeforeAfterGalleryCard';
import { PreenchimentoAplicacaoRepeater } from '@/components/consultation/PreenchimentoAplicacaoRepeater';
import { LipoenzimaticaAreasSection } from '@/components/consultation/LipoenzimaticaAreasSection';
import { LipoenzimaticaProdutosRepeater } from '@/components/consultation/LipoenzimaticaProdutosRepeater';
import { BotoxFacialMap } from '@/components/BotoxFacialMap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY_GALLERY = {
  beforeImages: [],
  afterImages: [],
  pairs: [],
};

type ProcedureFieldsScreenPreviewProps = {
  procedureName: string;
  procedureSlug: string;
  professionalId: string;
  fields: ProcedureFieldWithSettings[];
  showSessionPhotos: boolean;
  showBeforeAfterGallery?: boolean;
  showNextEvaluationSection?: boolean;
};

export function ProcedureFieldsScreenPreview({
  procedureName,
  procedureSlug,
  professionalId,
  fields,
  showSessionPhotos,
  showBeforeAfterGallery = true,
  showNextEvaluationSection = true,
}: ProcedureFieldsScreenPreviewProps) {
  const [expanded, setExpanded] = useState(true);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});
  const sessionDate = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    setPreviewData({});
    setExpanded(true);
  }, [procedureSlug, professionalId]);

  const visibleFields = useMemo(() => {
    const isPeim = procedureSlug === 'peim';
    const isPreenchimento = procedureSlug === 'preenchimento-facial';
    const isLipoenzimatica = procedureSlug === LIPOENZIMATICA_SLUG;
    const usoAnestesia = previewData.uso_anestesia === true;

    return fields
      .filter((field) => field.is_active)
      .filter((field) => !isLegacyBeforeAfterImageField(field))
      .filter((field) => !(procedureSlug === 'bioestimulador-colageno' && field.label === 'Data de retorno'))
      .filter((field) => !(isPeim && field.field_key === 'tipo_anestesia' && !usoAnestesia))
      .filter((field) => !(isPreenchimento && isPreenchimentoRepeatableFieldKey(field.field_key)))
      .filter((field) => !(isLipoenzimatica && isLipoenzimaticaHiddenFieldKey(field.field_key)));
  }, [fields, previewData.uso_anestesia, procedureSlug]);

  const showFacialMap = PROCEDURE_SLUGS_WITH_FACIAL_MAP.includes(
    procedureSlug as (typeof PROCEDURE_SLUGS_WITH_FACIAL_MAP)[number]
  );
  const isPeim = procedureSlug === 'peim';
  const isPreenchimento = procedureSlug === 'preenchimento-facial';
  const isLipoenzimatica = procedureSlug === LIPOENZIMATICA_SLUG;
  const aplicacoes = isPreenchimento ? getPreenchimentoAplicacoesForForm(previewData) : [];
  const lipoAreas = isLipoenzimatica ? getLipoenzimaticaAreasForForm(previewData) : [];
  const lipoProdutos = isLipoenzimatica ? getLipoenzimaticaProdutosForForm(previewData) : [];

  const setData = (key: string, value: unknown) => {
    setPreviewData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-primary/25 bg-muted/10 p-3 sm:p-4">
      <p className="text-xs text-muted-foreground text-center">
        Prévia fiel da consulta — mesmos componentes e layout da tela do profissional.
      </p>

      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
              <div className="flex flex-col space-y-1.5 text-left">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary shrink-0" />
                  {procedureName}
                </CardTitle>
                <CardDescription>Clique para preencher os dados desta sessão</CardDescription>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {visibleFields.length === 0 && !showFacialMap ? (
                <p className="text-sm text-muted-foreground py-6 text-center rounded-xl border border-dashed bg-muted/20">
                  Nenhum campo ativo. Ative campos na lista ao lado para vê-los aqui.
                </p>
              ) : (
                <>
                  {showFacialMap ? (
                    <div className="flex flex-col items-center pointer-events-none opacity-90">
                      <BotoxFacialMap
                        points={[]}
                        onChange={() => {}}
                        strokes={[]}
                        onStrokesChange={() => {}}
                        className="w-full"
                        imageSrc={procedureSlug === 'harmonizacao-glutea' ? '/gluteal-map.png' : undefined}
                        caption={
                          procedureSlug === 'harmonizacao-glutea'
                            ? 'Mapa glúteo — clique para marcar pontos de aplicação'
                            : undefined
                        }
                        antesPreviewVisible={expanded}
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isLipoenzimatica ? (
                      <>
                        <div className="pointer-events-none opacity-90 col-span-full">
                          <LipoenzimaticaAreasSection
                            items={lipoAreas}
                            onChange={() => {}}
                            userId={professionalId}
                            instanceIdOrTemp={`admin-preview-${procedureSlug}`}
                            previewVisible={expanded}
                          />
                        </div>
                        <div className="pointer-events-none opacity-90 col-span-full">
                          <LipoenzimaticaProdutosRepeater
                            items={
                              lipoProdutos.length > 0
                                ? lipoProdutos
                                : [createEmptyLipoenzimaticaProdutoItem()]
                            }
                            onChange={() => {}}
                          />
                        </div>
                      </>
                    ) : null}
                    {visibleFields.map((field) => {
                      const fullWidthOnDesktop = isProcedureFieldFullWidthOnDesktop(field, procedureSlug);
                      const labelOverride = isPeim ? PEIM_LABEL_OVERRIDES[field.field_key] : undefined;
                      const optionsOverride = isPeim ? PEIM_OPTIONS_OVERRIDES[field.field_key] : undefined;

                      if (isPreenchimento && field.field_key === 'plano_aplicacao') {
                        return (
                          <Fragment key={`${field.id}-preenchimento`}>
                            <div className="pointer-events-none opacity-90">
                              <PreenchimentoAplicacaoRepeater
                                items={aplicacoes.length > 0 ? aplicacoes : [createEmptyPreenchimentoAplicacaoItem()]}
                                onChange={() => {}}
                              />
                            </div>
                            <div className={fullWidthOnDesktop ? 'col-span-full' : undefined}>
                              {renderDynamicProcedureField({
                                field,
                                value: previewData[field.field_key],
                                onChange: setData,
                                sessionDate,
                                userId: professionalId,
                                instanceIdOrTemp: `admin-preview-${procedureSlug}`,
                                previewVisible: expanded,
                                readOnly: field.field_type === 'image',
                                labelOverride,
                                optionsOverride,
                              })}
                            </div>
                          </Fragment>
                        );
                      }

                      return (
                        <div key={field.id} className={fullWidthOnDesktop ? 'col-span-full' : undefined}>
                          {renderDynamicProcedureField({
                            field,
                            value: previewData[field.field_key],
                            onChange: setData,
                            sessionDate,
                            userId: professionalId,
                            instanceIdOrTemp: `admin-preview-${procedureSlug}`,
                            previewVisible: expanded,
                            readOnly: field.field_type === 'image',
                            labelOverride,
                            optionsOverride,
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {showBeforeAfterGallery ? (
                    <div className="pointer-events-none opacity-90">
                      <BeforeAfterGalleryCard
                        title="Galeria Antes e Depois"
                        description="Upload múltiplo com pares editáveis para este procedimento."
                        userId={professionalId}
                        instanceIdOrTemp={`admin-preview-gallery-${procedureSlug}`}
                        value={EMPTY_GALLERY}
                        onChange={() => {}}
                        disabled
                      />
                    </div>
                  ) : null}

                  {showNextEvaluationSection ? (
                    <div className="rounded-lg border border-border bg-muted/10 overflow-hidden pointer-events-none opacity-90">
                      <div className="flex flex-col space-y-1.5 p-3 sm:p-4 border-b border-border bg-muted/30 pb-3">
                        <h3 className="sm:text-xl flex items-center gap-2 text-base font-semibold tracking-tight">
                          <Bell className="w-5 h-5 text-primary" />
                          Próxima avaliação
                        </h3>
                        <p className="sm:text-sm text-muted-foreground mt-1 text-sm">
                          Defina o prazo para a próxima avaliação; ao agendar, o paciente pode receber lembrete por
                          WhatsApp.
                        </p>
                      </div>
                      <div className="sm:p-4 p-4 pt-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Prazo</Label>
                            <Input
                              type="number"
                              min={1}
                              placeholder="ex.: 90 dias"
                              className="h-10 w-40 rounded-xl"
                              disabled
                              readOnly
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 h-10 shrink-0 rounded-xl"
                            disabled
                          >
                            <CalendarPlus className="w-4 h-4" />
                            Agendar próxima avaliação
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {showSessionPhotos ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Fotos da sessão
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Fotos de antes e depois adicionadas nesta consulta.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-sm text-muted-foreground py-4 text-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10">
              Nenhuma foto adicionada nesta sessão.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
