/**
 * Attributes for auth cookies (accessToken / refreshToken).
 *
 * COOKIE_SAMESITE (default "strict") must be "none" when the frontend and API
 * are on different sites — e.g. two *.onrender.com hosts, since onrender.com
 * is a public suffix. Browsers only accept SameSite=None with Secure, so that
 * is forced on. Cross-site requests (incl. form posts) are then rejected by
 * the production CORS check in app.js, which blocks unlisted origins.
 *
 * Use the same attributes (without maxAge) for clearCookie: a cross-site
 * response can't overwrite a SameSite=None cookie with a Lax/Strict one.
 */
export const cookieSameSite = () => {
  const value = String(process.env.COOKIE_SAMESITE || "strict").toLowerCase();
  return ["strict", "lax", "none"].includes(value) ? value : "strict";
};

export const authCookieOptions = (options = {}) => {
  const sameSite = cookieSameSite();
  return {
    httpOnly: true,
    secure: sameSite === "none" || process.env.NODE_ENV === "production",
    sameSite,
    ...options,
  };
};
