import React from "react";

type HeaderTitleProps = {
  name: string;
  title: string;
  githubProject?: { url: string; label: string };
};

export default function HeaderTitle({
  name,
  title,
}: HeaderTitleProps) {
  return (
    <>
      <h1 className="text-3xl font-bold text-accent">
        {name}
      </h1>
      <h2 className="text-lg text-foreground-light">{title}</h2>
    </>
  );
}
