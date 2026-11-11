import eslint from "@eslint/js";
import banComments from "eslint-plugin-ban-comments";
import tseslint from "typescript-eslint";

const issueOrRfcLink = [
  String.raw`https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+`,
  String.raw`https://www\.rfc-editor\.org/rfc/rfc\d+`,
  String.raw`https://datatracker\.ietf\.org/doc/html/rfc\d+`,
];

const legalOrLicenceText = [
  String.raw`SPDX-License-Identifier`,
  String.raw`\bCopyright\b`,
  String.raw`\bLicen[cs]e\b`,
  String.raw`\(c\)`,
];

export default tseslint.config(
  {
    ignores: ["dist/**", ".astro/**", "content/**", "docs/**", "**/*.astro"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "astro.config.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    plugins: {
      "ban-comments": banComments,
    },
    rules: {
      "ban-comments/ban-comments": [
        "error",
        {
          allowEslintDirectives: false,
          allowTypeScriptDirectives: false,
          allowJSDoc: false,
          allowShebang: false,
          allowedPatterns: [...issueOrRfcLink, ...legalOrLicenceText],
        },
      ],
    },
  },
);
