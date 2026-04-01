"use client";
import React from 'react';

type DropdownMenuProps = {
  sections: Array<{
    title: string;
    items: Array<{
      name: string;
      href?: string;
      isHighlighted?: boolean;
    }>;
  }>;
  className?: string;
};

export function DropdownMenu({ sections, className = '' }: DropdownMenuProps) {
  return (
    <div className={`dropdown-menu ${className}`}>
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="dropdown-menu__section">
          <h3 className="dropdown-menu__title">{section.title}</h3>
          <ul className="dropdown-menu__list">
            {section.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <a 
                  href={item.href || '#'} 
                  className={`dropdown-menu__item ${item.isHighlighted ? 'dropdown-menu__item--highlighted' : ''}`}
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
