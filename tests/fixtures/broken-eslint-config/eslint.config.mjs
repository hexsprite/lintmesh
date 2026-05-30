// Intentionally broken flat config for regression testing.
// Imports a package that does not exist, so ESLint crashes at config-load
// time (ERR_MODULE_NOT_FOUND, exit code 2) — simulating the real-world case
// where a removed transitive dependency breaks eslint.config.mjs.
import nope from 'this-package-does-not-exist-lintmesh-regression'

export default [nope]
