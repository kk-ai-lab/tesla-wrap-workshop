# Dependency remediation

Tested 2026-11-12 in an isolated checkout using Node 22.23.4. The candidate changes Zod from `^3.24.0` to `^4.6.7` and Vitest from `^3.2.0` to `^4.1.12`. It scopes an override of minimatch to `^11.0.1` under `@typescript-eslint/typescript-estree`; the lockfile resolves 11.0.8. No application source or test assertions were changed.

- [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) identifies versions below 4.6.6 as affected by memory exhaustion during oversized constrained collection validation.
- [Vitest mocker advisories](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) and [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) identify versions below 4.1.11 and 4.1.12 respectively. Vitest 4.1.12 no longer lists tinypool as a dependency, removing the affected dependency identified in [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).
- [Minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) identifies versions 7 through 11.0.0 as affected. The latest typescript-eslint published at the time, 8.72.2, requires minimatch `^10.2.2`; the scoped override crosses its declared major range and should be removed when upstream adopts a patched release. Existing lint passes but does not prove all minimatch behavior compatible.

`npm audit` reported zero findings after the changes. `vitest run` passed 114 tests in seven files; `tsc --noEmit` and `eslint .` passed. These checks cover the isolated baseline, not newer uncommitted files in the main worktree. The Zod and Vitest upgrades are major releases; passing existing checks does not prove every runtime behavior is unchanged. Full repository verification and browser checks remain for integration.

The Node 22 bundled npm 10.9.9 failed while incrementally installing Vitest with an Arborist `edgesOut` error. Using npm 11.19.1 under Node 22 generated the candidate lockfile; a subsequent clean `npm ci` with npm 10.9.9 succeeded and reported zero vulnerabilities. No forced audit fix was used.
