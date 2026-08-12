"use client";

import Editor from "@monaco-editor/react";

export function CodeEditor({ value, language, onChange, readOnly = false }: { value: string; language: string; onChange?: (value: string) => void; readOnly?: boolean }) {
  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(next) => onChange?.(next ?? "")}
      loading={<div className="loading-page" style={{ minHeight: 300, background: "#1e1e28" }}><div className="spinner" /></div>}
      options={{
        minimap: { enabled: false },
        fontFamily: "var(--font-mono), Consolas, monospace",
        fontSize: 13,
        lineHeight: 21,
        padding: { top: 14 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: "on",
        renderLineHighlight: "line",
        bracketPairColorization: { enabled: true },
        readOnly,
        domReadOnly: readOnly,
        folding: true,
        lineNumbersMinChars: 3,
      }}
    />
  );
}
