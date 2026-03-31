import React from "react";

interface ClearCacheButtonProps {
  label: string;
  onClear: () => void;
  disabled: boolean;
}

export default function ClearCacheButton({ label, onClear, disabled }: ClearCacheButtonProps) {
  return (
    <button className="btn btn-secondary" onClick={onClear} disabled={disabled}>
      {label}
    </button>
  );
}
