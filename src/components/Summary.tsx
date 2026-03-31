import React from 'react';
import '@/styles/components/section-toggler.css';
import { CvData } from '@/types/cv';
import SectionCard from './SectionCard';
import { sanitizeHtml } from '@/utils/sanitize';

interface SummaryProps {
  data: CvData;
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Summary({ data, title, open, setOpen }: SummaryProps) {
  return (
    <SectionCard title={title} open={open} setOpen={setOpen} titleClassName="text-xl mb-2">
      <div
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(data?.summary) }}
      />
    </SectionCard>
  );
}
