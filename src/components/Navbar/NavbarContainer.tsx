import React from "react";

interface NavbarContainerProps {
  children: React.ReactNode;
  githubProjectLink?: React.ReactNode;
}

export default function NavbarContainer({ children, githubProjectLink }: NavbarContainerProps) {
  return (
    <header className="topbar" style={{ position: 'relative' }}>
      {githubProjectLink && (
        <div className="github-project-link-fixed" tabIndex={0} aria-label="Link para o projeto no Github">
          {githubProjectLink}
        </div>
      )}
      <div className="toolbar navbar-container">{children}</div>
    </header>
  );
}
