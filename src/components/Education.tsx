import { CvData } from "@/types/cv";
import React from "react";
import SectionCard from "./SectionCard";

interface EducationProps {
  data: CvData;
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Education({ data, title, open, setOpen }: EducationProps) {
  return (
    <SectionCard title={title} open={open} setOpen={setOpen} titleClassName="text-lg font-semibold">
      {data.education?.map((ed) => (
        <div key={ed.institution} className="mb-4">
          <div className="font-semibold">{ed.institution}</div>
          <div className="text-sm text-muted">
            {ed.degree} · {ed.period}
          </div>
          {ed.details && <p className="mt-1">{ed.details}</p>}
        </div>
      ))}
    </SectionCard>
  );
}
