/**
 * Escape user input for use inside a RegExp / MongoDB $regex so it is matched
 * literally (prevents regex injection and catastrophic-backtracking DoS).
 */
export const escapeRegExp = (value) =>
  String(value ?? "")
    .slice(0, 200)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default escapeRegExp;
