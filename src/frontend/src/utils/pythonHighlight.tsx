import React from "react";

const KEYWORDS = new Set([
  "if",
  "else",
  "elif",
  "for",
  "while",
  "def",
  "class",
  "import",
  "from",
  "return",
  "True",
  "False",
  "None",
  "and",
  "or",
  "not",
  "in",
  "is",
  "lambda",
  "with",
  "as",
  "pass",
  "break",
  "continue",
  "raise",
  "try",
  "except",
  "finally",
  "yield",
  "global",
  "nonlocal",
  "del",
  "assert",
  "async",
  "await",
]);

const BUILTINS = new Set([
  "print",
  "len",
  "range",
  "input",
  "int",
  "str",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "isinstance",
  "enumerate",
  "zip",
  "map",
  "filter",
  "sorted",
  "reversed",
  "sum",
  "min",
  "max",
  "abs",
  "round",
  "open",
  "super",
  "hasattr",
  "getattr",
  "setattr",
  "vars",
  "dir",
  "object",
  "property",
  "staticmethod",
  "classmethod",
  "repr",
  "id",
  "hex",
  "oct",
  "bin",
  "ord",
  "chr",
  "format",
  "hash",
  "iter",
  "next",
  "all",
  "any",
  "callable",
  "Exception",
  "ValueError",
  "TypeError",
  "KeyError",
  "IndexError",
  "AttributeError",
  "ImportError",
  "OSError",
  "RuntimeError",
  "StopIteration",
  "NotImplementedError",
  "NameError",
  "ZeroDivisionError",
]);

// Vivid, high-contrast color palette
const COLORS = {
  keyword: "#FF79C6", // hot pink — def, if, for, return…
  builtin: "#50FA7B", // bright green — print, len, range…
  string: "#F1FA8C", // bright yellow — "hello"
  number: "#BD93F9", // purple — 42, 3.14
  comment: "#6272A4", // muted blue-grey — # comment
  decorator: "#FFB86C", // orange — @decorator
  operator: "#FF5555", // red — + - * / = == !=
  punct: "#8BE9FD", // cyan — ( ) [ ] { } , .
  default: "#F8F8F2", // off-white — identifiers
};

const OPERATOR_RE = /^(==|!=|<=|>=|\*\*|\/\/|[-+*/%=<>!&|^~])$/;
const PUNCT_RE = /^[()\[\]{},.:;]$/;

export function highlightPython(code: string): React.ReactNode {
  if (!code) return null;

  const tokens: React.ReactNode[] = [];
  let key = 0;
  let lastIndex = 0;

  const fullRe =
    /(@[a-zA-Z_]\w*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#[^\n]*|0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|[a-zA-Z_]\w*|==|!=|<=|>=|\*\*|\/\/|[-+*/%=<>!&|^~]|[()\[\]{},.:;]|\s+)/g;

  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = fullRe.exec(code)) !== null) {
    if (m.index > lastIndex) {
      tokens.push(
        <span key={key++} style={{ color: COLORS.default }}>
          {code.slice(lastIndex, m.index)}
        </span>,
      );
    }
    lastIndex = fullRe.lastIndex;

    const tok = m[0];
    let color: string;
    let fontStyle: string | undefined;
    let fontWeight: string | undefined;

    if (tok.startsWith("@")) {
      color = COLORS.decorator;
    } else if (
      tok.startsWith('"""') ||
      tok.startsWith("'''") ||
      tok.startsWith('"') ||
      tok.startsWith("'")
    ) {
      color = COLORS.string;
    } else if (tok.startsWith("#")) {
      color = COLORS.comment;
      fontStyle = "italic";
    } else if (/^0x[0-9a-fA-F]+$/.test(tok) || /^\d/.test(tok)) {
      color = COLORS.number;
    } else if (/^[a-zA-Z_]\w*$/.test(tok)) {
      if (KEYWORDS.has(tok)) {
        color = COLORS.keyword;
        fontWeight = "700";
      } else if (BUILTINS.has(tok)) {
        color = COLORS.builtin;
      } else {
        color = COLORS.default;
      }
    } else if (/^\s+$/.test(tok)) {
      tokens.push(<React.Fragment key={key++}>{tok}</React.Fragment>);
      continue;
    } else if (OPERATOR_RE.test(tok)) {
      color = COLORS.operator;
    } else if (PUNCT_RE.test(tok)) {
      color = COLORS.punct;
    } else {
      color = COLORS.default;
    }

    tokens.push(
      <span key={key++} style={{ color, fontStyle, fontWeight }}>
        {tok}
      </span>,
    );
  }

  if (lastIndex < code.length) {
    tokens.push(
      <span key={key++} style={{ color: COLORS.default }}>
        {code.slice(lastIndex)}
      </span>,
    );
  }

  return <>{tokens}</>;
}

export { KEYWORDS, BUILTINS };
