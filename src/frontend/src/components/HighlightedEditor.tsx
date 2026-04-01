import { highlightPython } from "@/utils/pythonHighlight";
import type React from "react";
import { forwardRef, useImperativeHandle, useRef } from "react";

interface HighlightedEditorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  spellCheck?: boolean;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  "data-ocid"?: string;
  fontSize?: number;
  fontFamily?: string;
}

export const HighlightedEditor = forwardRef<
  HTMLTextAreaElement,
  HighlightedEditorProps
>(function HighlightedEditor(
  {
    value,
    onChange,
    onKeyDown,
    onClick,
    onKeyUp,
    placeholder,
    disabled,
    className,
    style,
    spellCheck = false,
    autoComplete = "off",
    autoCorrect = "off",
    autoCapitalize = "off",
    "data-ocid": dataOcid,
    fontSize = 14,
    fontFamily,
  },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = () => {
    if (preRef.current && innerRef.current) {
      preRef.current.scrollTop = innerRef.current.scrollTop;
      preRef.current.scrollLeft = innerRef.current.scrollLeft;
    }
  };

  const resolvedFamily = fontFamily
    ? `${fontFamily}, monospace`
    : "'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace";

  const sharedStyle: React.CSSProperties = {
    fontFamily: resolvedFamily,
    fontSize: `${fontSize}px`,
    lineHeight: "1.65",
    tabSize: 4,
    padding: "16px 20px",
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    overflowWrap: "break-word",
  };

  return (
    <div
      className={`relative flex-1 overflow-hidden ${className ?? ""}`}
      style={style}
    >
      {/* Syntax-highlighted backdrop */}
      <pre
        ref={preRef}
        aria-hidden
        style={{
          ...sharedStyle,
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          color: "#D4D4D4",
          background: "transparent",
          zIndex: 0,
        }}
      >
        {highlightPython(value)}
        {/* Trailing newline prevents last-line flicker */}
        {"\n"}
      </pre>

      {/* Transparent textarea on top */}
      <textarea
        ref={innerRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onKeyUp={onKeyUp}
        onScroll={handleScroll}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={spellCheck}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        data-ocid={dataOcid}
        style={{
          ...sharedStyle,
          position: "absolute",
          inset: 0,
          resize: "none",
          background: "transparent",
          color: "transparent",
          caretColor: "oklch(0.72 0.17 160)",
          border: "none",
          outline: "none",
          zIndex: 1,
          width: "100%",
          height: "100%",
          overflow: "auto",
        }}
        className="scrollbar-ide"
      />
    </div>
  );
});
