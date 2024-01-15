"use client";
import Header_03 from "./Header_03";

type Props = {};

export default function Header({}: Props) {
  return (
    <div className="flex flex-row justify-end h-8 w-full px-8">
      <Header_03>Sound</Header_03>
      <span className="w-[8px]" />
      <Header_03>Settings</Header_03>
    </div>
  );
}
