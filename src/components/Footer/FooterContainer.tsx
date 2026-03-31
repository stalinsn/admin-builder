import React from 'react';

interface FooterContainerProps {
  children: React.ReactNode;
}

export default function FooterContainer({ children }: FooterContainerProps) {
  return (
    <footer className="w-full text-center text-sm text-muted mt-8 mb-4">
      {children}
    </footer>
  );
}
