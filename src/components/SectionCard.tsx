import React from 'react';

interface SectionCardProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
  titleClassName?: string;
  contentClassName?: string;
}

export default function SectionCard({
  title,
  open,
  setOpen,
  children,
  titleClassName = '',
  contentClassName = '',
}: SectionCardProps) {
  return (
    <section className="card">
      <button
        className="section-toggler"
        aria-expanded={open}
        title={open ? 'Minimizar' : 'Expandir'}
        onClick={() => setOpen(!open)}
      >
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 9L11 13L15 9" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <h2 className={`font-semibold ${titleClassName}`} style={{ paddingRight: 32 }}>{title}</h2>
      <div className={`section-content${open ? ' open' : ' closed'} ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}
