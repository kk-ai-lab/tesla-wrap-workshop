import eslint from "@eslint/js";
import banComments from "eslint-plugin-ban-comments";
import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

const allowedCommentSources = [
  String.raw`^https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+$`,
  String.raw`^https://www\.rfc-editor\.org/rfc/rfc\d+$`,
  String.raw`^https://datatracker\.ietf\.org/doc/html/rfc\d+$`,
  String.raw`^SPDX-License-Identifier:\s+[A-Za-z0-9][A-Za-z0-9.\-+]*$`,
];

const allowedCommentPatterns = allowedCommentSources.map((source) => new RegExp(source));

function allowsComment(text) {
  const trimmed = text.trim();
  return allowedCommentPatterns.some((pattern) => pattern.test(trimmed));
}

const astroHtmlCommentBan = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow HTML comments in Astro templates",
    },
    schema: [],
    messages: {
      noComments: "Comments are not allowed.",
    },
  },
  create(context) {
    return {
      AstroHTMLComment(node) {
        const value = typeof node.value === "string" ? node.value : "";
        if (!allowsComment(value)) {
          context.report({ node, messageId: "noComments" });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ["dist/**", ".astro/**", "content/**", "docs/**", "test/lint-fixtures/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...eslintPluginAstro.configs["flat/base"],
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
      "astro-comments": {
        rules: {
          "ban-html-comments": astroHtmlCommentBan,
        },
      },
    },
    rules: {
      "ban-comments/ban-comments": [
        "error",
        {
          allowEslintDirectives: false,
          allowTypeScriptDirectives: false,
          allowJSDoc: false,
          allowShebang: false,
          allowedPatterns: allowedCommentSources,
        },
      ],
    },
  },
  {
    files: ["**/*.astro"],
    rules: {
      "astro-comments/ban-html-comments": "error",
    },
  },
);
