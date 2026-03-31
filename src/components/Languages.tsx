import React from 'react';
import '@/styles/components/section-toggler.css';
import { CvData } from '@/types/cv';
import SectionCard from './SectionCard';

interface LanguagesProps {
  data: CvData;
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Languages({ data, title, open, setOpen }: LanguagesProps) {
  return (
    <SectionCard title={title} open={open} setOpen={setOpen} titleClassName="text-lg">
      <ul className="list-disc pl-6 space-y-1">
        {data.languages.map((lang) => (
          <li key={lang.name}>
            {lang.name}: <strong>{lang.level}</strong>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
