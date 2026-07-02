/**
 * Polyfill for jest-mock@29 + jest-runtime@30 version mismatch.
 * jest-runtime@30 calls this._moduleMocker.clearMocksOnScope(global)
 * but the method was only added in jest-mock@30.
 * Load with: node -r ./jest-mock-polyfill.js node_modules/.bin/jest
 */
const { ModuleMocker } = require('jest-mock');
if (typeof ModuleMocker.prototype.clearMocksOnScope !== 'function') {
  ModuleMocker.prototype.clearMocksOnScope = function (_scope) {
    // no-op: our tests don't use jest.mock() scope tracking
  };
}
