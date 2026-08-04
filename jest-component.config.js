/**
 * DEPRECATED — kept only so `npx jest -c jest-component.config.js` still works.
 *
 * This used to be a second, richer jest config that the component suites were
 * written against, while `npm test` used jest.config.js. Nothing in package.json
 * ever ran it, so the two drifted: two component suites could not even load
 * under `npm test`, and its testMatch still listed tests/badge-animation.test.tsx,
 * a file that no longer exists.
 *
 * Everything it provided now lives in jest.config.js. Re-exporting instead of
 * duplicating means the two configs can never disagree again.
 */
module.exports = require('./jest.config.js');
