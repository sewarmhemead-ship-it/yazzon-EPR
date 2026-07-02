/**
 * transactions.service.js
 * الطبقة: service — منطق أعمال حركات المخزون + فرض الـ Invariants.
 * يفرض:
 *   [INV-1] لا رصيد سالب — عبر UPDATE شرطي ذرّي في الـ repository.
 *   [INV-2] كل حركة = معاملة DB واحدة — كل عملية ملفوفة بـ withTransaction.
 *   [INV-3] السجل ثابت — التصحيح = حركة عكسية جديدة تشير للأصلية، لا حذف/تعديل.
 *   [INV-4] الكميات numeric — تمرَّر كنصّ عشري بلا تحويل float (انظر validate.js).
 *   [INV-6] وحدة أساسية واحدة — كل الكميات بوحدة العنصر الأساسية.
 */

import { withTransaction } from '../../shared/withTransaction.js';
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import {
  assertPositiveQuantity,
  assertSignedNonZeroQuantity,
  assertNonEmptyString,
} from '../../shared/validate.js';
import { findItemByIdTx } from '../items/items.repository.js';
import {
  decrementStock,
  incrementStock,
  applyStockDelta,
  insertTransaction,
  findTransactionById,
  hasReversal,
  listTransactions,
} from './transactions.repository.js';

/** أنواع الحركات (لا أرقام/نصوص سحرية متناثرة). */
export const TX_TYPE = Object.freeze({
  IN: 'in',
  OUT: 'out',
  WASTE: 'waste',
  ADJUSTMENT: 'adjustment',
});

/** الأنواع التي تُنقص الرصيد (سحب حقيقي من المخزون). */
const CONSUMING_TYPES = new Set([TX_TYPE.OUT, TX_TYPE.WASTE]);

/**
 * يُدخل كمية إلى المخزون (استلام توصيلة) ويسجّلها كحركة in.
 * لماذا معاملة واحدة: تحديث الرصيد وتسجيل الحركة يجب أن ينجحا معاً [INV-2].
 * @param {object} input
 * @param {string} input.itemId معرّف العنصر.
 * @param {string} input.userId المستخدم المنفّذ.
 * @param {string|number} input.quantity كمية موجبة بالوحدة الأساسية.
 * @param {string} [input.note] ملاحظة اختيارية.
 * @returns {Promise<{ item: object, transaction: object }>}
 * @throws {NotFoundError} إن لم يوجد العنصر.
 */
export async function addStock({ itemId, userId, quantity, note }) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const uid = assertNonEmptyString(userId, 'userId');
  const qty = assertPositiveQuantity(quantity, 'quantity'); // [INV-4]

  return withTransaction(async (client) => {
    const item = await incrementStock(client, id, qty);
    if (!item) {
      throw new NotFoundError('العنصر غير موجود');
    }
    const transaction = await insertTransaction(client, {
      itemId: id,
      userId: uid,
      type: TX_TYPE.IN,
      quantityChange: qty, // موجب = إدخال
      note,
    });
    return { item, transaction };
  });
}

/**
 * يسحب كمية من المخزون (استهلاك أو هدر) ويسجّلها كحركة out/waste.
 * ⚠️ [INV-1] الإنقاص يتم عبر UPDATE شرطي ذرّي واحد (decrementStock)؛ صفر صفوف = رصيد غير كافٍ.
 *    لا نقرأ الرصيد ثم نقرّر — ذلك يعيد الـ Race Condition. الـ SELECT التالي للتشخيص فقط.
 * @param {object} input
 * @param {string} input.itemId
 * @param {string} input.userId
 * @param {string|number} input.quantity كمية موجبة تُسحب.
 * @param {'out'|'waste'} [input.type] نوع السحب (افتراضي out). waste = خسارة (القسم 7).
 * @param {string} [input.note]
 * @returns {Promise<{ item: object, transaction: object }>}
 * @throws {ValidationError} لنوع غير مسموح.
 * @throws {NotFoundError} إن لم يوجد العنصر.
 * @throws {InsufficientStockError} إن كان الرصيد غير كافٍ.
 */
export async function consumeStock({ itemId, userId, quantity, type = TX_TYPE.OUT, note }) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const uid = assertNonEmptyString(userId, 'userId');
  const qty = assertPositiveQuantity(quantity, 'quantity'); // [INV-4]
  if (!CONSUMING_TYPES.has(type)) {
    throw new ValidationError(`نوع السحب غير صالح: ${type}`);
  }

  return withTransaction(async (client) => {
    // [INV-1] الإنقاص الذرّي الشرطي — القرار كله داخل هذه الجملة.
    const item = await decrementStock(client, id, qty);
    if (!item) {
      // فشل الإنقاص: إمّا عنصر غير موجود أو رصيد غير كافٍ. SELECT للتمييز فقط
      // (بعد فشل UPDATE الذرّي — لا يؤثّر على الذرّية ولا يعيد الـ Race Condition).
      const exists = await findItemByIdTx(client, id);
      if (!exists) {
        throw new NotFoundError('العنصر غير موجود');
      }
      throw new InsufficientStockError();
    }
    const transaction = await insertTransaction(client, {
      itemId: id,
      userId: uid,
      type,
      quantityChange: `-${qty}`, // سالب = سحب
      note,
    });
    return { item, transaction };
  });
}

/**
 * تسوية جرد: يطبّق فرقاً موقّعاً على الرصيد لمصالحة النظام مع الواقع (القسم 7).
 * الفرق قد يكون موجباً أو سالباً؛ لا يُسمح بنزول الرصيد تحت الصفر [INV-1].
 * @param {object} input
 * @param {string} input.itemId
 * @param {string} input.userId
 * @param {string|number} input.delta الفرق الموقّع (غير صفري).
 * @param {string} [input.note] سبب التسوية (يُنصح به للتوثيق).
 * @returns {Promise<{ item: object, transaction: object }>}
 * @throws {NotFoundError} إن لم يوجد العنصر.
 * @throws {InsufficientStockError} إن كان الفرق السالب يتجاوز الرصيد المتاح.
 */
export async function adjustStock({ itemId, userId, delta, note }) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const uid = assertNonEmptyString(userId, 'userId');
  const signedDelta = assertSignedNonZeroQuantity(delta, 'delta'); // [INV-4]

  return withTransaction(async (client) => {
    // [INV-1] تطبيق ذرّي شرطي: current_stock + delta >= 0.
    const item = await applyStockDelta(client, id, signedDelta);
    if (!item) {
      const exists = await findItemByIdTx(client, id);
      if (!exists) {
        throw new NotFoundError('العنصر غير موجود');
      }
      throw new InsufficientStockError('التسوية تُنزل الرصيد تحت الصفر');
    }
    const transaction = await insertTransaction(client, {
      itemId: id,
      userId: uid,
      type: TX_TYPE.ADJUSTMENT,
      quantityChange: signedDelta,
      note,
    });
    return { item, transaction };
  });
}

/**
 * يتراجع عن حركة سابقة بإنشاء حركة عكسية تشير إليها [INV-3] — دون حذف/تعديل الأصلية.
 * الحركة العكسية تطبّق عكس أثر الأصلية على الرصيد ذرّياً مع منع الرصيد السالب [INV-1].
 * لماذا: التصحيح موثّق ومترابط؛ لا يمحو التاريخ بل يضيف إليه.
 * @param {object} input
 * @param {string} input.transactionId معرّف الحركة الأصلية.
 * @param {string} input.userId المستخدم المنفّذ للتراجع.
 * @param {string} [input.note] سبب التراجع.
 * @returns {Promise<{ item: object, transaction: object }>} العنصر بعد التصحيح والحركة العكسية.
 * @throws {NotFoundError} إن لم توجد الحركة الأصلية.
 * @throws {ValidationError} إن كانت الحركة مُراجَعة سابقاً أو كانت هي نفسها حركة عكسية.
 * @throws {InsufficientStockError} إن كان عكس الأثر يُنزل الرصيد تحت الصفر (استُهلك بالفعل).
 */
export async function undoTransaction({ transactionId, userId, note }) {
  const txId = assertNonEmptyString(transactionId, 'transactionId');
  const uid = assertNonEmptyString(userId, 'userId');

  return withTransaction(async (client) => {
    const original = await findTransactionById(client, txId);
    if (!original) {
      throw new NotFoundError('الحركة غير موجودة');
    }
    // لا نتراجع عن حركة عكسية (يمنع سلاسل تصحيح ملتبسة) [INV-3].
    if (original.reverses_transaction_id) {
      throw new ValidationError('لا يمكن التراجع عن حركة تصحيح');
    }
    // منع التراجع المزدوج عن نفس الحركة.
    if (await hasReversal(client, txId)) {
      throw new ValidationError('تمّ التراجع عن هذه الحركة من قبل');
    }

    // أثر التراجع = عكس quantity_change الأصلي (نصّ numeric، بلا حساب float [INV-4]).
    const reversalDelta = negateNumericString(original.quantity_change);

    // [INV-1] تطبيق ذرّي مع منع النزول تحت الصفر (مثلاً التراجع عن in استُهلك بعضه).
    const item = await applyStockDelta(client, original.item_id, reversalDelta);
    if (!item) {
      throw new InsufficientStockError('لا يمكن التراجع: الرصيد الحالي لا يكفي لعكس الحركة');
    }

    // [INV-3] حركة عكسية جديدة تشير للأصلية — الأصلية تبقى كما هي.
    const transaction = await insertTransaction(client, {
      itemId: original.item_id,
      userId: uid,
      type: TX_TYPE.ADJUSTMENT,
      quantityChange: reversalDelta,
      note: note ?? `تراجع عن الحركة ${txId}`,
      reversesTransactionId: txId,
    });
    return { item, transaction };
  });
}

/** الحدّ الأقصى المسموح لصفوف سجل الحركات في طلب واحد. */
const HISTORY_MAX_LIMIT = 200;
/** الحدّ الافتراضي لصفوف السجل. */
const HISTORY_DEFAULT_LIMIT = 50;

/**
 * يقرأ سجل الحركات (الأحدث أولاً) بفلاتر اختيارية — "ما الذي دخل/خرج/فسد/صُحّح".
 * قراءة فقط من السجل الثابت [INV-3].
 * @param {object} [filters]
 * @param {string} [filters.itemId]
 * @param {string} [filters.locationId] قسم/براد.
 * @param {string} [filters.type] in|out|waste|adjustment.
 * @param {string|number} [filters.limit]
 * @returns {Promise<object[]>}
 * @throws {ValidationError} لنوع غير معروف.
 */
export async function getTransactions({ itemId, locationId, type, limit } = {}) {
  if (type && !Object.values(TX_TYPE).includes(type)) {
    throw new ValidationError(`نوع حركة غير معروف: ${type}`);
  }
  const parsed = Number.parseInt(limit ?? HISTORY_DEFAULT_LIMIT, 10);
  const safeLimit = Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, 1), HISTORY_MAX_LIMIT)
    : HISTORY_DEFAULT_LIMIT;
  return listTransactions({
    itemId: itemId || null,
    locationId: locationId || null,
    type: type || null,
    limit: safeLimit,
  });
}

/**
 * يعكس إشارة رقم عشري ممثَّل كنصّ دون تحويله إلى float [INV-4].
 * @param {string} value نصّ رقم numeric من قاعدة البيانات (مثل "5", "-2.5").
 * @returns {string} النص بإشارة معكوسة ("-5", "2.5").
 */
function negateNumericString(value) {
  const str = String(value).trim();
  if (str.startsWith('-')) {
    return str.slice(1);
  }
  return `-${str}`;
}
