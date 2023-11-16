"use client";

type Props = {
  title: string;
};

export default function PageHeader({ title }: Props) {
  return (
    <div className="">
      <h1 className="text-white text-9xl">{title}</h1>
    </div>
  );
}
