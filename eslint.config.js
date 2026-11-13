import { fixupPluginRules } from "@eslint/compat";
import eslint from "@eslint/js";
import banComments from "eslint-plugin-ban-comments";
import eslintPluginAstro from "eslint-plugin-astro";
import postcss from "postcss";
import tseslint from "typescript-eslint";
import { allowedCommentSources, allowsComment } from "./scripts/comment-allowlist.js";

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

function attributeName(attr) {
  const name = attr?.name;
  if (name?.type === "JSXIdentifier") {
    return { local: name.name };
  }
  if (name?.type === "JSXNamespacedName") {
    return { ns: name.namespace?.name, local: name.name?.name };
  }
  return {};
}

function literalValue(node) {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node?.type === "JSXExpressionContainer" && node.expression?.type === "Literal") {
    return typeof node.expression.value === "string" ? node.expression.value : undefined;
  }
  return undefined;
}

function textHasBlockComment(value) {
  return typeof value === "string" && value.includes("/*");
}

function expressionHasBlockComment(node, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) {
    return false;
  }
  seen.add(node);
  if (node.type === "Literal" && textHasBlockComment(node.value)) {
    return true;
  }
  if (node.type === "TemplateElement") {
    const cooked = node.value?.cooked ?? node.value?.raw;
    if (textHasBlockComment(cooked)) {
      return true;
    }
  }
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      if (value.some((item) => expressionHasBlockComment(item, seen))) {
        return true;
      }
    } else if (value && typeof value === "object" && expressionHasBlockComment(value, seen)) {
      return true;
    }
  }
  return false;
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

const astroStyleSetDirectiveBan = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      setDirective: "set:html and set:text are not allowed on style.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (jsxName(node) !== "style") {
          return;
        }
        for (const attr of node.openingElement?.attributes ?? []) {
          const { ns, local } = attributeName(attr);
          if (ns === "set" && (local === "html" || local === "text")) {
            context.report({ node: attr, messageId: "setDirective" });
          }
        }
      },
    };
  },
};

const astroStyleAttributeCommentBan = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      attribute: "Comments are not allowed in a style attribute.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (attributeName(node).local !== "style" || attributeName(node).ns !== undefined) {
          return;
        }
        const value = node.value;
        if (value?.type === "Literal" && textHasBlockComment(value.value)) {
          context.report({ node, messageId: "attribute" });
          return;
        }
        if (value?.type === "JSXExpressionContainer" && expressionHasBlockComment(value.expression)) {
          context.report({ node, messageId: "attribute" });
        }
      },
    };
  },
};

function styleCanBeInspected(node) {
  const children = (node.children ?? []).filter(
    (child) => !(child.type === "JSXText" && typeof child.value === "string" && child.value.trim() === ""),
  );
  if (children.length === 0 || children.some((child) => child.type !== "AstroRawText")) {
    return false;
  }
  for (const child of children) {
    try {
      postcss.parse(child.value);
    } catch {
      return false;
    }
  }
  return true;
}

const astroUninspectedStyleBan = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      uninspected: "Style content cannot be inspected.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (jsxName(node) !== "style") {
          return;
        }
        for (const attr of node.openingElement?.attributes ?? []) {
          if (attributeName(attr).local === "lang" && literalValue(attr.value) !== "css") {
            context.report({ node: attr, messageId: "uninspected" });
          }
        }
        if (!styleCanBeInspected(node)) {
          context.report({ node, messageId: "uninspected" });
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

export const commentLintKinds = [
  {
    id: "astro-html",
    rule: "astro-comments/ban-html-comments",
    fixture: "test/lint-fixtures/html-comment.astro",
  },
  {
    id: "astro-style",
    rule: "astro-comments/ban-style-comments",
    fixture: "test/lint-fixtures/style-comment.astro",
  },
  {
    id: "astro-set-directive",
    rule: "astro-comments/ban-style-set-directive",
    fixture: "test/lint-fixtures/style-set-html.astro",
  },
  {
    id: "astro-style-attribute",
    rule: "astro-comments/ban-style-attribute-comment",
    fixture: "test/lint-fixtures/style-attr-static.astro",
  },
  {
    id: "astro-uninspected-style",
    rule: "astro-comments/ban-uninspected-style",
    fixture: "test/lint-fixtures/style-lang-scss.astro",
  },
  {
    id: "ts-line-comment",
    rule: "ban-comments/ban-comments",
    fixture: "test/lint-fixtures/issue-link-hack.ts",
  },
  {
    id: "astro-frontmatter",
    rule: "ban-comments/ban-comments",
    fixture: "test/lint-fixtures/frontmatter-comment.astro",
  },
];

function astroCommentRules() {
  const rules = {};
  for (const kind of commentLintKinds) {
    if (kind.rule.startsWith("astro-comments/")) {
      rules[kind.rule] = "error";
    }
  }
  return rules;
}

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
    files: ["scripts/**/*.mjs", ".cursor/skills/**/*.mjs", "astro.config.mjs"],
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
      "ban-comments": fixupPluginRules(banComments),
      "astro-comments": {
        rules: {
          "ban-html-comments": astroHtmlCommentBan,
          "ban-style-comments": astroStyleCommentBan,
          "ban-style-set-directive": astroStyleSetDirectiveBan,
          "ban-style-attribute-comment": astroStyleAttributeCommentBan,
          "ban-uninspected-style": astroUninspectedStyleBan,
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
    rules: astroCommentRules(),
  },
);
