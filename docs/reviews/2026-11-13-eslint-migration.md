# ESLint migration review

A clean installation reported that ESLint 9 was no longer supported. This change upgrades to ESLint 10 and its directly imported `@eslint/js` package. The existing comment-ban plugin uses a removed rule-context method, so the configuration wraps it with ESLint's [`@eslint/compat` utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/). No comment-ban test was weakened or removed. [Issue 29](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/29) records the migration.

The installed Astro version already requires Node 22.23.4 or later. The project engine declaration now states that minimum within the Node 22 series. ESLint 10 and `@eslint/compat` require Node 22.13.0 or later within that series.

A direct ESLint upgrade initially introduced four moderate audit findings through minimatch 10. Two scoped overrides under ESLint and `@eslint/config-array` resolve minimatch 11.0.8, alongside the existing TypeScript ESLint override. A clean npm audit then reported zero findings. All three overrides cross their consumers' declared minimatch major ranges. [Issue 22](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/22) tracks removing them as upstream consumers adopt a patched version.

On Node 22.23.4, a clean install and the full local verification passed 142 unit tests, including all 28 comment-ban fixture tests, and four desktop/mobile browser tests. The catalogue, provenance, build, distribution, gallery, postbuild, and legal-inventory checks also passed.

Two independent adversarial reviews found no candidate-only behavior failure. One compared 276 API cases against ESLint 9 and exercised CLI globs, hidden and bracketed names, stdin, ignores, and inline suppressions. The other ran 37 paired CLI probes and compared all 49 linted repository files and their diagnostics. Both confirmed a zero-finding lockfile audit. These checks cover the current project and selected inputs; they do not prove equivalence for every future minimatch pattern or platform.
