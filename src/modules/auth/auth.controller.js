/**
 * auth.controller.js
 * Layer: controller — HTTP only for auth routes. No business logic.
 */

/**
 * Returns the currently authenticated user (as loaded by requireAuth),
 * letting the frontend know the identity and role after sign-in.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function getMe(req, res) {
  res.json({ user: req.user });
}
