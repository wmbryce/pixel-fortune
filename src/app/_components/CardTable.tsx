"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Card from "./Card";
import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, stagger } from "framer-motion";
import { randomInt } from "crypto";

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
  }, [visibleCards]);

  console.log("visible cards");
  // const spinningCard = {
  //   spinIn: { 0: {y: -500},
  //   center: { y: 0 },
  //   spinOut: { y: 500 },
  // };

  console.log("testing card table: ", tarotHand);

  useEffect(() => {
    console.log("start animation");
  }, [tarotHand]);

  return (
    <motion.ul className="flex flex-wrap my-[30px] flex-1 justify-start">
      <AnimatePresence>
        {tarotHand
          ?.slice(0, visibleCards)
          .map((data: CardType, index: number) => (
            <motion.li key={index} initial={{ y: -300 }} animate={{ y: 0 }}>
              <Card
                id={"t-card-" + index}
                data={index < visibleCards ? data : null}
              />
            </motion.li>
          ))}
      </AnimatePresence>
    </motion.ul>
  );
}
