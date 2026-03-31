import React from "react";

interface ModalBaseProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

const ModalBase: React.FC<ModalBaseProps> = ({ open, children, className }) => {
  if (!open) return null;
  return (
    <div className="fallback-modal-overlay">
      <div className={className || "fallback-modal-card"}>
        {children}
      </div>
    </div>
  );
};

export default ModalBase;
