/**
 * validate.test.js
 * طبقة الاختبار: unit — تتحقق من قواعد الكميات والنصوص دون قاعدة بيانات.
 * الهدف: حماية [INV-4] من تحويلات float أو قبول صيغ غير صالحة.
 */

import { describe, expect, it } from 'vitest';
import {
  assertNonEmptyString,
  assertPositiveQuantity,
  assertSignedNonZeroQuantity,
} from '../../src/shared/validate.js';

describe('shared/validate unit tests', () => {
  it('assertPositiveQuantity يعيد النص العشري كما هو لتفادي float [INV-4]', () => {
    expect(assertPositiveQuantity('0.1', 'quantity')).toBe('0.1');
    expect(assertPositiveQuantity('2.500', 'quantity')).toBe('2.500');
  });

  it('assertPositiveQuantity يرفض الصفر والسالب والفاصلة الألمانية في backend', () => {
    expect(() => assertPositiveQuantity('0', 'quantity')).toThrow();
    expect(() => assertPositiveQuantity('-1', 'quantity')).toThrow();
    expect(() => assertPositiveQuantity('2,5', 'quantity')).toThrow();
  });

  it('assertSignedNonZeroQuantity يقبل دلتا موجبة/سالبة ويرفض الصفر', () => {
    expect(assertSignedNonZeroQuantity('-0.5', 'delta')).toBe('-0.5');
    expect(assertSignedNonZeroQuantity('3', 'delta')).toBe('3');
    expect(() => assertSignedNonZeroQuantity('0', 'delta')).toThrow();
  });

  it('assertNonEmptyString يقص النص ويرفض الفراغ', () => {
    expect(assertNonEmptyString('  Gouda  ', 'name')).toBe('Gouda');
    expect(() => assertNonEmptyString('   ', 'name')).toThrow();
  });
});
