"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Card from "./Card";

type Props = {
  //   TarotHand?: CardType[];
};

export default function CardTable({}: Props) {
  const getTarotHand = trpc.getTarotHand.useQuery();

  return (
    <div>
      <div className="flex flex-row">
        {getTarotHand.data?.map((data: CardType, index: number) => (
          <Card key={index} data={data} />
        ))}
      </div>
    </div>
  );
}
