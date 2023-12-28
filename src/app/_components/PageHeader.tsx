"use client";

type Props = {};

export default function Header({}: Props) {
  return (
    <div className="flex flex-row justify-end h-8 w-full px-8">
      <h1 className="text-white font-sans font-bold mx-8">{"Sound"}</h1>
      <h1 className="text-white font-sans font-bold">{"Settings"}</h1>
    </div>
  );
}
