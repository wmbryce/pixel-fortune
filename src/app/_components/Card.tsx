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

  return (
    <>
      {data ? (
        <div className="h-96 w-64 p-4 m-4 bg-white br-4 flex flex-col align-center justify-center rounded-md overflow animate-fadeIn">
          <Image
            width={300}
            height={500}
            className="h-[500px] w-[290px] object-contain"
            src={
              showCardFace
                ? "/assets/cards/" + data?.image
                : "/assets/cards/CardBack.png"
            }
            alt={data?.name}
          />
          <div className="text-black align-center font-sans">{data?.name}</div>
        </div>
      ) : (
        <div className="h-96 w-64 p-4 m-4 bg-brown_02 opacity-0 br-4 flex flex-col align-center justify-center rounded-md"></div>
      )}
    </>
  );
}
