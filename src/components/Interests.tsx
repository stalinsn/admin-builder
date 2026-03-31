import React from "react";
import SectionCard from "./SectionCard";
import { labels } from "@/data/labels";
import { useI18n } from "@/hooks/useI18n";

interface InterestsProps {
  interests: string[];
  open: boolean;
  setOpen: (open: boolean) => void;
  title?: string;
}

export default function Interests({ interests, open, setOpen, title }: InterestsProps) {
  const { lang } = useI18n();
  return (
    <SectionCard
      title={title !== undefined ? title : (labels.interests?.[lang as keyof typeof labels.interests] || "Interesses")}
      open={open}
      setOpen={setOpen}
      titleClassName="text-xl mb-4"
    >
      <ul className="list-disc ml-6">
        {interests.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </SectionCard>
  );
}
