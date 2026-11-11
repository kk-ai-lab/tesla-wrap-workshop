import eslint from "@eslint/js";
import banComments from "eslint-plugin-ban-comments";
import eslintPluginAstro from "eslint-plugin-astro";
import postcss from "postcss";
import tseslint from "typescript-eslint";

const allowedCommentSources = [
  String.raw`^https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+$`,
  String.raw`^https://www\.rfc-editor\.org/rfc/rfc\d+$`,
  String.raw`^https://datatracker\.ietf\.org/doc/html/rfc\d+$`,
  String.raw`^SPDX-License-Identifier:[ \t]+[A-Za-z0-9][A-Za-z0-9.\-+]*$`,
];

const allowedCommentPatterns = allowedCommentSources.map((source) => new RegExp(source));

function allowsComment(text) {
  const trimmed = text.trim();
  return allowedCommentPatterns.some((pattern) => pattern.test(trimmed));
}

const commentBanMeta = {
  type: "problem",
  schema: [],
  messages: {
    noComments: "Comments are not allowed.",
  },
};

function jsxName(node) {
  const name = node?.openingElement?.name;
  if (name?.type === "JSXIdentifier") {
    return name.name;
  }
  return undefined;
}

function reportCssComments(context, textNode) {
  let root;
  try {
    root = postcss.parse(textNode.value);
  } catch {
    context.report({ node: textNode, messageId: "noComments" });
    return;
  }
  const base = textNode.loc?.start;
  root.walkComments((comment) => {
    if (allowsComment(comment.text)) {
      return;
    }
    const start = comment.source?.start;
    const end = comment.source?.end;
    if (base === undefined || start === undefined || end === undefined) {
      context.report({ node: textNode, messageId: "noComments" });
      return;
    }
    context.report({
      loc: {
        start: {
          line: base.line + start.line - 1,
          column: start.line === 1 ? base.column + start.column - 1 : start.column - 1,
        },
        end: {
          line: base.line + end.line - 1,
          column: end.line === 1 ? base.column + end.column - 1 : end.column - 1,
        },
      },
      messageId: "noComments",
    });
  });
}

const astroHtmlCommentBan = {
  meta: commentBanMeta,
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

const astroStyleCommentBan = {
  meta: commentBanMeta,
  create(context) {
    return {
      JSXElement(node) {
        if (jsxName(node) !== "style") {
          return;
        }
        for (const child of node.children ?? []) {
          if (child.type === "AstroRawText" && typeof child.value === "string") {
            reportCssComments(context, child);
          }
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ["dist/**", ".astro/**", "content/**", "docs/**", "test/lint-fixtures/**"],
  },
  {
    linterOptions: {
      noInlineConfig: true,
    },
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
          "ban-style-comments": astroStyleCommentBan,
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
      "astro-comments/ban-style-comments": "error",
    },
  },
);
