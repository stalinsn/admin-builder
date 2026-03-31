import React from "react";

interface ExportButtonProps {
  label: string;
}

export default function ExportButton({ label }: ExportButtonProps) {
  return (
    <button className="btn" onClick={() => window.print()}>
      {label}
    </button>
  );
}
