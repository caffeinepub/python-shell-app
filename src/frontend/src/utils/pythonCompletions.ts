import { BUILTINS, KEYWORDS } from "./pythonHighlight";

export function extractUserDefinedNames(code: string): string[] {
  const names = new Set<string>();
  const defRe = /(?:def|class)\s+([a-zA-Z_]\w*)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = defRe.exec(code)) !== null) names.add(m[1]);
  const assignRe = /^[ \t]*([a-zA-Z_]\w*)\s*=/gm;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = assignRe.exec(code)) !== null) {
    if (!KEYWORDS.has(m[1]) && !BUILTINS.has(m[1])) names.add(m[1]);
  }
  return Array.from(names);
}

export const ALL_COMPLETIONS: string[] = [
  ...Array.from(KEYWORDS),
  ...Array.from(BUILTINS),
].sort();
