import React from 'react';
import SectionCard from './SectionCard';
import '@/styles/components/section-toggler.css';

interface SkillsProps {
  titleMain: string;
  titleTech: string;
  data: {
    coreSkills: string[];
    technicalSkills: Record<string, string>;
  };
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Skills({ data, titleMain, titleTech, open, setOpen }: SkillsProps) {
  return (
    <SectionCard title={titleMain} open={open} setOpen={setOpen} titleClassName="text-xl mb-4">
      <div className="tag-list mb-6">
        {data.coreSkills.map((item, index) => (
          <span key={index} className="tag">
            {item}
          </span>
        ))}
      </div>
      <h3 className="text-lg font-medium mb-2">{titleTech}</h3>
      <table className="w-full">
        <tbody>
          {Object.entries(data.technicalSkills).map(([key, value]) => (
            <tr key={key}>
              <th className="pr-4 text-left align-top">{key}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
