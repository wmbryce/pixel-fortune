"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Card from "./Card";
import { useEffect, useState } from "react";

type Props = {
  tarotHand?: CardType[];
};

export default function CardTable({ tarotHand }: Props) {
  const [visibleCards, setVisibleCards] = useState<number>(-1);
  const emptyArray = [null, null, null, null, null];
  useEffect(() => {
    if (!!tarotHand && visibleCards < 6) {
      setTimeout(() => {
        setVisibleCards(visibleCards + 1);
      }, 900);
    }
  });
  return (
    <div className="flex flex-row my-[30px] flex-1">
      {tarotHand
        ? tarotHand?.map((data: CardType, index: number) => (
            <Card key={index} data={index < visibleCards ? data : null} />
          ))
        : emptyArray?.map((data: any, index: number) => {
            return <Card key={index} data={data} />;
          })}
    </div>
  );
}
