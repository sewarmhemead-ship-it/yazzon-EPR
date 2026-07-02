/**
 * items.service.js
 * الطبقة: service — منطق أعمال العناصر + التحقق من المدخلات.
 * يفرض: [INV-4] min_stock_level numeric (نصّ عشري بلا float)، [INV-6] وحدة أساسية واحدة.
 * لا يتحكّم بـ current_stock: الرصيد يتغيّر عبر حركات مسجّلة فقط [INV-3] (transactions.service).
 */

import { NotFoundError } from '../../shared/errors.js';
import { assertNonEmptyString, assertPositiveQuantity } from '../../shared/validate.js';
import {
  listItems,
  findItemById,
  createItem,
  updateItem,
} from './items.repository.js';

/** الحدّ الأدنى الافتراضي عند عدم تمريره (يطابق افتراضي قاعدة البيانات). */
const DEFAULT_MIN_STOCK = '1';

/**
 * يعيد كل العناصر (لقائمة الواجهة).
 * @returns {Promise<object[]>}
 */
export async function getItems() {
  return listItems();
}

/**
 * يعيد عنصراً واحداً بمعرّفه.
 * @param {string} itemId
 * @returns {Promise<object>}
 * @throws {NotFoundError} إن لم يوجد العنصر.
 */
export async function getItem(itemId) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const item = await findItemById(id);
  if (!item) {
    throw new NotFoundError('العنصر غير موجود');
  }
  return item;
}

/**
 * يُنشئ عنصراً جديداً (إنشاء سريع لمادة جديدة — القسم 7).
 * يبدأ الرصيد صفراً؛ أي كمية ابتدائية تُسجَّل لاحقاً بحركة in [INV-3].
 * @param {object} input
 * @param {string} input.name اسم العنصر.
 * @param {string} input.unit الوحدة الأساسية [INV-6].
 * @param {string|number} [input.minStockLevel] حدّ التنبيه (موجب)؛ الافتراضي 1.
 * @param {string|null} [input.categoryId] تصنيف اختياري.
 * @returns {Promise<object>} العنصر المُنشأ.
 * @throws {ValidationError} لمدخلات غير صالحة.
 */
export async function addItem({ name, unit, minStockLevel, categoryId, locationId }) {
  const cleanName = assertNonEmptyString(name, 'name');
  const cleanUnit = assertNonEmptyString(unit, 'unit'); // [INV-6]
  const min =
    minStockLevel === undefined || minStockLevel === null || minStockLevel === ''
      ? DEFAULT_MIN_STOCK
      : assertPositiveQuantity(minStockLevel, 'minStockLevel'); // [INV-4]

  return createItem({
    name: cleanName,
    unit: cleanUnit,
    minStockLevel: min,
    categoryId: categoryId ?? null,
    locationId: locationId ?? null,
  });
}

/**
 * يعدّل بيانات عنصر الوصفية (لا يمسّ الرصيد [INV-3]).
 * تحديث جزئي: تُمرَّر فقط الحقول المراد تغييرها.
 * @param {string} itemId
 * @param {object} changes
 * @param {string} [changes.name]
 * @param {string} [changes.unit]
 * @param {string|number} [changes.minStockLevel]
 * @param {string|null} [changes.categoryId]
 * @returns {Promise<object>} العنصر بعد التعديل.
 * @throws {NotFoundError} إن لم يوجد العنصر.
 * @throws {ValidationError} لمدخلات غير صالحة.
 */
export async function editItem(itemId, changes) {
  const id = assertNonEmptyString(itemId, 'itemId');

  // نتحقّق فقط من الحقول المُمرَّرة (تحديث جزئي).
  const name =
    changes.name === undefined ? null : assertNonEmptyString(changes.name, 'name');
  const unit =
    changes.unit === undefined ? null : assertNonEmptyString(changes.unit, 'unit');
  const minStockLevel =
    changes.minStockLevel === undefined
      ? null
      : assertPositiveQuantity(changes.minStockLevel, 'minStockLevel');
  const categoryId = changes.categoryId === undefined ? null : changes.categoryId;
  const locationId = changes.locationId === undefined ? null : changes.locationId;

  const item = await updateItem(id, { name, unit, minStockLevel, categoryId, locationId });
  if (!item) {
    throw new NotFoundError('العنصر غير موجود');
  }
  return item;
}
