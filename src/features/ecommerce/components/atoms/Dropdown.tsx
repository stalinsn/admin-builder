"use client";
import React, { useState, useRef, useEffect } from 'react';

type DropdownProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Dropdown({ trigger, children, className = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={`dropdown ${className}`} ref={dropdownRef}>
      <div 
        className="dropdown__trigger" 
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
        {trigger}
      </div>
      {isOpen && (
        <div
          className="dropdown__content"
          onClickCapture={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest('a[href]')) {
              setIsOpen(false);
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
