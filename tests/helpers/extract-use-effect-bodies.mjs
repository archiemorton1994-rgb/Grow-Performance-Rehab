/**
 * Shared helper: extractUseEffectBodies(source)
 *
 * Extracts the callback body of every `useEffect(...)` call found in `source`.
 * Returns an array of body strings — one per useEffect — suitable for substring
 * searching (e.g. body.includes('setSomeState(null)')).
 *
 * Handles all three arrow-function forms:
 *
 *   Block body:
 *     useEffect(() => { doSomething(); }, [deps])
 *     → body: " doSomething(); "
 *
 *   Async block body:
 *     useEffect(async () => { await doSomething(); }, [deps])
 *     → body: " await doSomething(); "
 *
 *   Concise arrow body:
 *     useEffect(() => doSomething(), [deps])
 *     → body: "doSomething()"
 *
 * The original block-body-only implementation missed the concise form, which
 * means `useEffect(() => setSomeFilter(null), [deps])` would not be flagged
 * as a useEffect body — a silent false-green in the filter-reset-safety tests.
 *
 * Algorithm overview
 * ──────────────────
 * 1. Scan for each `useEffect(` call.
 * 2. Skip optional `async` keyword.
 * 3. Skip the arrow-function params `(...)`.
 * 4. Expect `=>`.
 * 5a. If next char is `{` → brace-depth counter extracts block body.
 * 5b. Otherwise → collect chars until `,` or `)` at depth 0 (concise body).
 */

/** Advance `pos` past any whitespace characters. */
function skipWS(source, pos) {
  while (pos < source.length && /\s/.test(source[pos])) pos++;
  return pos;
}

/**
 * `source[pos]` must equal `open`. Advance past the matching `close` using a
 * depth counter, then return the position immediately after the closing char.
 */
function skipMatchingClose(source, pos, open, close) {
  let depth = 1;
  pos++; // step past the opening char
  while (pos < source.length && depth > 0) {
    if (source[pos] === open) depth++;
    else if (source[pos] === close) depth--;
    pos++;
  }
  return pos; // pos is now just past the matching close
}

/**
 * Returns an array of useEffect body strings extracted from `source`.
 * Each string is the raw content inside the callback (trimmed for concise
 * bodies, raw for block bodies).
 */
export function extractUseEffectBodies(source) {
  const bodies = [];
  const UE = /useEffect\s*\(/g;
  let m;

  while ((m = UE.exec(source)) !== null) {
    let pos = m.index + m[0].length; // right after 'useEffect('
    pos = skipWS(source, pos);

    // ── Optional 'async' keyword ────────────────────────────────────────────
    // Match 'async' only when followed by whitespace or '(' (not a longer id).
    if (
      source.slice(pos, pos + 5) === 'async' &&
      pos + 5 < source.length &&
      /[\s(]/.test(source[pos + 5])
    ) {
      pos = skipWS(source, pos + 5);
    }

    // ── Arrow function params '(...)' ────────────────────────────────────────
    if (source[pos] !== '(') continue; // not an arrow function — skip
    pos = skipMatchingClose(source, pos, '(', ')');

    // ── Arrow '=>' ───────────────────────────────────────────────────────────
    pos = skipWS(source, pos);
    if (source.slice(pos, pos + 2) !== '=>') continue;
    pos += 2;
    pos = skipWS(source, pos);

    // ── Body ─────────────────────────────────────────────────────────────────
    if (source[pos] === '{') {
      // Block body: collect everything between matching braces.
      const bodyOpen = pos + 1;
      pos = skipMatchingClose(source, pos, '{', '}');
      bodies.push(source.slice(bodyOpen, pos - 1));
    } else {
      // Concise body: collect until ',' or ')' at depth 0.
      // Depth tracks nested ( [ { so we don't stop inside function calls.
      const exprStart = pos;
      let depth = 0;
      while (pos < source.length) {
        const ch = source[pos];
        if (ch === '(' || ch === '[' || ch === '{') {
          depth++;
          pos++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          if (depth === 0) break; // closing the useEffect() call itself
          depth--;
          pos++;
        } else if (ch === ',' && depth === 0) {
          break; // separator between callback and deps array
        } else {
          pos++;
        }
      }
      bodies.push(source.slice(exprStart, pos).trim());
    }
  }

  return bodies;
}
