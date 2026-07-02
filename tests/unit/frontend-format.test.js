/**
 * frontend-format.test.js
 * طبقة الاختبار: unit — أدوات عرض الواجهة دون تشغيل المتصفح.
 * الهدف: حماية الفاصلة الألمانية وعرض الكسور بلا ضجيج float.
 */

import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  normalizeDecimalInput,
  POSITIVE_DECIMAL,
} from '../../frontend/src/lib/format.js';

describe('frontend format unit tests', () => {
  it('يطبع الفاصلة الألمانية إلى نقطة قبل الإرسال', () => {
    expect(normalizeDecimalInput(' 2,5 ')).toBe('2.5');
    expect(POSITIVE_DECIMAL.test(normalizeDecimalInput('2,5'))).toBe(true);
  });

  it('formatNumber يخفي ضجيج float في العرض فقط', () => {
    expect(formatNumber(1.2000000000000002)).toBe('1.2');
    expect(formatNumber('2.500')).toBe('2.5');
  });
});
