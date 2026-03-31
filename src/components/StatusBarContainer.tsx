import React from 'react';

interface StatusBarContainerProps {
  position: { top: number; left: number };
  dragging: boolean;
  barRef: React.RefObject<HTMLDivElement>;
  expanded: boolean;
  children: React.ReactNode;
}

export default function StatusBarContainer({
  position,
  dragging,
  barRef,
  expanded,
  children,
}: StatusBarContainerProps) {
  return (
    <div
      ref={barRef}
      className={`statusbar-draggable${!expanded ? ' minimized' : ''}`}
      style={{
        top: position.top,
        left: position.left,
        width: expanded ? '370px' : '230px',
        transition: dragging ? 'none' : 'all 0.3s cubic-bezier(.4,2,.6,1)',
        cursor: dragging ? 'grabbing' : 'default',
      }}
    >
      {children}
    </div>
  );
}
