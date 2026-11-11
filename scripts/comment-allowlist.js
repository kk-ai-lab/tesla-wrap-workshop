export const allowedCommentSources = [
  String.raw`^https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+$`,
  String.raw`^https://www\.rfc-editor\.org/rfc/rfc\d+$`,
  String.raw`^https://datatracker\.ietf\.org/doc/html/rfc\d+$`,
  String.raw`^SPDX-License-Identifier:[ \t]+[A-Za-z0-9][A-Za-z0-9.\-+]*$`,
];

const allowedCommentPatterns = allowedCommentSources.map((source) => new RegExp(source));

export function allowsComment(text) {
  const trimmed = text.trim();
  return allowedCommentPatterns.some((pattern) => pattern.test(trimmed));
}
