"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";

type Props = {
  data: CardType;
};

export default function Card({ data }: Props) {
  return (
    <div className="h-64 w-32 m-4 bg-white br-4 flex align-center justify-center rounded-md">
      <div className="py-24 text-black align-center">{data?.name}</div>
    </div>
  );
}
