/**
 * locations.controller.js
 * Layer: controller — HTTP only. No business logic.
 */

import { getLocations, addLocation } from './locations.service.js';

/** Lists all locations. */
export async function listAll(_req, res, next) {
  try {
    const locations = await getLocations();
    res.json({ locations });
  } catch (err) {
    next(err);
  }
}

/** Creates a location. */
export async function create(req, res, next) {
  try {
    const { name, position } = req.body ?? {};
    const location = await addLocation(name, position);
    res.status(201).json({ location });
  } catch (err) {
    next(err);
  }
}
