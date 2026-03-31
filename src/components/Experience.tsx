import { CvData } from "@/types/cv";
import React from "react";
import SectionCard from "./SectionCard";
import "@/styles/components/section-toggler.css";

interface ExperienceProps {
  data: CvData;
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Experience({
  data,
  title,
  open,
  setOpen,
}: ExperienceProps) {
  return (
    <SectionCard
      title={title}
      open={open}
      setOpen={setOpen}
      titleClassName="text-lg font-semibold experience-title"
    >
      {data.experience?.map((exp) => (
        <div key={exp.company} className="experience-item">
          <div className="experience-header">
            <span className="experience-role">{exp.role}</span>
            <span className="experience-sep">|</span>
            <span className="experience-company">{exp.company}</span>
            <span className="experience-dot">·</span>
            <span className="experience-period">{exp.period}</span>
            <span className="experience-dot">·</span>
            <span className="experience-location">{exp.location}</span>
          </div>
          <ul className="experience-bullets">
            {exp.bullets.map((bullet, idx) => (
              <li key={idx}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </SectionCard>
  );
}
