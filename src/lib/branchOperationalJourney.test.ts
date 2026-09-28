import { describe, expect, it } from 'vitest';
import {
  ALLOWED_STAGE_TRANSITIONS,
  canTransitionStage,
  getPipelineColumnForStage,
  isFollowUpOverdue,
  requiresCaptureChannel,
} from './branchOperationalJourney';

describe('branchOperationalJourney', () => {
  it('exige canal de captação para novo contato sem paciente', () => {
    expect(requiresCaptureChannel(null)).toBe(true);
    expect(requiresCaptureChannel(undefined)).toBe(true);
    expect(requiresCaptureChannel('uuid')).toBe(false);
  });

  it('permite transições válidas da jornada', () => {
    expect(canTransitionStage('captacao', 'cadastro_inicial')).toBe(true);
    expect(canTransitionStage('orcamento_enviado', 'fechado')).toBe(true);
    expect(canTransitionStage('encerrado_positivo', 'captacao')).toBe(false);
  });

  it('cobre todas as etapas no pipeline', () => {
    const allStages = Object.keys(ALLOWED_STAGE_TRANSITIONS);
    for (const stage of allStages) {
      expect(getPipelineColumnForStage(stage as keyof typeof ALLOWED_STAGE_TRANSITIONS).stages.length).toBeGreaterThan(0);
    }
  });

  it('detecta follow-up atrasado', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isFollowUpOverdue(past, 'pending')).toBe(true);
    expect(isFollowUpOverdue(past, 'completed')).toBe(false);
  });

  it('impede encerramento positivo direto de captação', () => {
    expect(canTransitionStage('captacao', 'encerrado_positivo')).toBe(false);
  });
});
