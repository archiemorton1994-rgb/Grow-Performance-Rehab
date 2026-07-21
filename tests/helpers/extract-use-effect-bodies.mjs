/**
 * Shared helper: extractUseEffectBodies(source)
 *
 * Extracts the callback body of every `useEffect(...)` call found in `source`.
 * Returns an array of body strings — one per useEffect — suitable for substring
 * searching (e.g. body.includes('setSomeState(null)')).
 *
 * Handles four callback forms:
 *
 *   Block-body arrow:
 *     useEffect(() => { doSomething(); }, [deps])
 *     → body: " doSomething(); "
 *
 *   Async block-body arrow:
 *     useEffect(async () => { await doSomething(); }, [deps])
 *     → body: " await doSomething(); "
 *
 *   Concise arrow:
 *     useEffect(() => doSomething(), [deps])
 *     → body: "doSomething()"
 *
 *   Anonymous / named function expression:
 *     useEffect(function () { doSomething(); }, [deps])
 *     useEffect(function myEffect() { doSomething(); }, [deps])
 *     → body: " doSomething(); "
 *
 * The original block-body-only regex missed concise arrows and function
 * expressions — both are now covered so that a one-liner or function-keyword
 * useEffect cannot smuggle in a filter reset undetected.
 *
 * Algorithm overview
 * ──────────────────
 * 1. Scan for each `useEffect(` call.
 * 2. Branch on the next non-whitespace token:
 *    a. `function` keyword → named/anonymous function-expression path
 *    b. `async` or `(` → arrow-function path (with optional async prefix)
 * 3a. Function-expression path:
 *     skip `function`, skip optional name identifier, skip params `(...)`,
 *     then extract the block body `{ ... }`.
 * 3b. Arrow-function path:
 *     skip optional `async`, skip params `(...)`, expect `=>`,
 *     then extract either block body `{ ... }` or concise body (expr).
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

    // ── Branch: function expression vs. arrow function ────────────────────────
    if (
      source.slice(pos, pos + 8) === 'function' &&
      pos + 8 < source.length &&
      /[\s(*]/.test(source[pos + 8])
    ) {
      // ── Named / anonymous function expression ────────────────────────────────
      // Forms: useEffect(function() {...})  useEffect(function name() {...})
      pos += 8; // skip 'function'
      pos = skipWS(source, pos);

      // Optional function name — skip word characters (letters, digits, $, _)
      if (source[pos] !== '(') {
        while (pos < source.length && /[\w$]/.test(source[pos])) pos++;
        pos = skipWS(source, pos);
      }

      // Params '(...)'
      if (source[pos] !== '(') continue;
      pos = skipMatchingClose(source, pos, '(', ')');
      pos = skipWS(source, pos);

      // Function expressions always have a block body
      if (source[pos] !== '{') continue;
      const feBodyOpen = pos + 1;
      pos = skipMatchingClose(source, pos, '{', '}');
      bodies.push(source.slice(feBodyOpen, pos - 1));
    } else {
      // ── Arrow function (sync or async) ────────────────────────────────────────
      // Optional 'async' — match only when followed by whitespace or '('
      if (
        source.slice(pos, pos + 5) === 'async' &&
        pos + 5 < source.length &&
        /[\s(]/.test(source[pos + 5])
      ) {
        pos = skipWS(source, pos + 5);
      }

      // Arrow function params must start with '('
      if (source[pos] !== '(') continue; // not a recognised callback form — skip
      pos = skipMatchingClose(source, pos, '(', ')');

      // Arrow '=>'
      pos = skipWS(source, pos);
      if (source.slice(pos, pos + 2) !== '=>') continue;
      pos += 2;
      pos = skipWS(source, pos);

      // Body: block or concise
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
  }

  return bodies;
}
