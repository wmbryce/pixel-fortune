"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Image from "next/image";

type Props = {
  data: CardType;
};

export default function Card({ data }: Props) {
  return (
    <div className="h-96 w-64 p-4 m-4 bg-white br-4 flex flex-col align-center justify-center rounded-md">
      <Image
        width={300}
        height={500}
        className="h-[500px] w-[300px]"
        src={"/assets/cards/" + data?.image}
        alt={data?.name}
      />
      <div className="text-black align-center font-sans">{data?.name}</div>
    </div>
  );
}
