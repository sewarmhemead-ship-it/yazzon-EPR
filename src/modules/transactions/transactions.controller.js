/**
 * transactions.controller.js
 * الطبقة: controller — HTTP فقط: يقرأ الطلب، يستدعي الـ service، يعيد الرد. لا منطق أعمال.
 * userId يُؤخذ دائماً من req.user (الهوية الموثّقة) لا من جسم الطلب — لضمان ربط الحركة
 * بمنفّذها الحقيقي (القسم 7: حسم النزاعات)، ومنع انتحال الهوية.
 * الأخطاء تُمرَّر عبر next(err) إلى errorHandler المركزي (لا try/catch يبتلعها).
 */

import {
  addStock,
  consumeStock,
  adjustStock,
  undoTransaction,
  getTransactions,
} from './transactions.service.js';

/** سجل الحركات (فلاتر عبر query string). */
export async function list(req, res, next) {
  try {
    const { itemId, locationId, type, limit } = req.query;
    const transactions = await getTransactions({ itemId, locationId, type, limit });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

/** استلام كمية (in). */
export async function receive(req, res, next) {
  try {
    const { itemId, quantity, note } = req.body ?? {};
    const result = await addStock({ itemId, userId: req.user.id, quantity, note });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/** سحب كمية (out أو waste). */
export async function consume(req, res, next) {
  try {
    const { itemId, quantity, type, note } = req.body ?? {};
    const result = await consumeStock({ itemId, userId: req.user.id, quantity, type, note });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/** تسوية جرد (adjustment). */
export async function adjust(req, res, next) {
  try {
    const { itemId, delta, note } = req.body ?? {};
    const result = await adjustStock({ itemId, userId: req.user.id, delta, note });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/** تراجع عن حركة سابقة (حركة عكسية). */
export async function undo(req, res, next) {
  try {
    const { note } = req.body ?? {};
    const result = await undoTransaction({
      transactionId: req.params.id,
      userId: req.user.id,
      note,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
