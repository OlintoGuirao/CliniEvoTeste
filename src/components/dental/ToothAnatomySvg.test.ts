import { describe, expect, it } from 'vitest';
import { toothKindFromFdi } from './ToothAnatomySvg';
import {
  DECIDUOUS_FDI_LAYOUT,
  getToothAssetUrl,
  getToothDentition,
  getToothRow,
  getToothSvgRaw,
  hasToothAsset,
  prepareToothSvgMarkup,
} from './toothAssets';

describe('toothKindFromFdi', () => {
  it('classifica tipos FDI permanentes', () => {
    expect(toothKindFromFdi('11')).toBe('incisor');
    expect(toothKindFromFdi('12')).toBe('lateral');
    expect(toothKindFromFdi('13')).toBe('canine');
    expect(toothKindFromFdi('14')).toBe('premolar');
    expect(toothKindFromFdi('16')).toBe('molar');
    expect(toothKindFromFdi('18')).toBe('wisdom');
    expect(toothKindFromFdi('36')).toBe('molar');
  });
});

describe('toothAssets', () => {
  it('carrega SVG raw permanentes e decíduos', () => {
    expect(hasToothAsset('11')).toBe(true);
    expect(hasToothAsset('55')).toBe(true);
    expect(getToothSvgRaw('11')).toContain('<svg');
    expect(getToothSvgRaw('55')).toContain('<svg');
    expect(getToothAssetUrl('11')).toBe('permanentes/11.svg');
    expect(getToothAssetUrl('55')).toBe('deciduos/55.svg');
  });

  it('define dentition e row FDI', () => {
    expect(getToothDentition('16')).toBe('permanente');
    expect(getToothDentition('55')).toBe('deciduo');
    expect(getToothRow('16')).toBe('superior');
    expect(getToothRow('46')).toBe('inferior');
  });

  it('injeta data-attributes no SVG preparado', () => {
    const raw = getToothSvgRaw('16');
    expect(raw).toBeTruthy();
    const html = prepareToothSvgMarkup(raw!, {
      tooth: '16',
      dentition: 'permanente',
      row: 'superior',
      selected: true,
    });
    expect(html).toContain('data-tooth-number="16"');
    expect(html).toContain('data-dentition="permanente"');
    expect(html).toContain('data-row="superior"');
    expect(html).toContain('selected');
  });

  it('expõe layout FDI decíduo esperado', () => {
    expect([...DECIDUOUS_FDI_LAYOUT.superiorDireito]).toEqual(['55', '54', '53', '52', '51']);
    expect([...DECIDUOUS_FDI_LAYOUT.superiorEsquerdo]).toEqual(['61', '62', '63', '64', '65']);
    expect([...DECIDUOUS_FDI_LAYOUT.inferiorEsquerdo]).toEqual(['71', '72', '73', '74', '75']);
    expect([...DECIDUOUS_FDI_LAYOUT.inferiorDireito]).toEqual(['81', '82', '83', '84', '85']);
  });
});
