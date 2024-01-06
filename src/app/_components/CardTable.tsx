"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Card from "./Card";

type Props = {
  tarotHand?: CardType[];
};

export default function CardTable({ tarotHand }: Props) {
  return (
    tarotHand && (
      <div className="flex flex-row">
        {tarotHand?.map((data: CardType, index: number) => (
          <Card key={index} data={data} />
        ))}
      </div>
    )
  );
}
