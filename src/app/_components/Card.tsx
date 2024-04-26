"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  data?: CardType | null;
};

export default function Card({ data }: Props) {
  const [showCardFace, setShowCardFace] = useState<boolean>(false);

  useEffect(() => {
    if (!!data) {
      setTimeout(() => {
        setShowCardFace(true);
      }, 3000);
    }
  });

  const width = 80;

  const height = (3 / 5) * 80;

  return (
    <>
      {data && (
        <div className="sm:h-[15rem] md:h-[25rem] sm:w-[9rem] md:w-[15rem] lg: w-[15rem] p-4 m-4 bg-white br-4  align-center justify-center rounded-md animate-fadeIn">
          <Image
            width={300}
            height={500}
            className="h-[22rem] w-[13.2rem]"
            src={
              showCardFace
                ? "/assets/cards/" + data?.image
                : "/assets/cards/CardBack.png"
            }
            alt={data?.name}
          />
          <div className="text-black align-center font-sans">{data?.name}</div>
        </div>
      )}
    </>
  );
}
