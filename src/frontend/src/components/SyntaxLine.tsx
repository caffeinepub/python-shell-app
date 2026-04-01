import { highlightPython } from "@/utils/pythonHighlight";

interface SyntaxLineProps {
  code: string;
}

export function SyntaxLine({ code }: SyntaxLineProps) {
  return <>{highlightPython(code)}</>;
}
