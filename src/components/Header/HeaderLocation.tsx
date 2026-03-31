import React from "react";

type HeaderLocationProps = {
  location: string;
};

export default function HeaderLocation({ location }: HeaderLocationProps) {
  return <p>{location}</p>;
}
