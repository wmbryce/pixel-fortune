"use client";
import { CardType } from "@/types";
import Card from "./Card";
import { useEffect, useState } from "react";
import { animate, motion, stagger } from "framer-motion";
import { Props } from "./CardTable";

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

  // const spinningCard = {
  //   spinIn: { 0: {y: -500},
  //   center: { y: 0 },
  //   spinOut: { y: 500 },
  // };
  const staggerDelay = 0.1;
  const stageDuration = 0.01;

  const transit = {
    duration: stageDuration,
    type: "spring",
    mass: 1,
  };

  useEffect(() => {
    const tCard = document.getElementById("t-card");
    if (!!tCard) {
      animate(
        [
          [
            "li",
            { y: 0 },
            {
              ...transit,
              delay: 0,
            },
          ],
          [
            "li",
            { y: -20 },
            {
              ...transit,
              delay: stagger(staggerDelay),
            },
          ],
          [
            "li",
            { y: 20 },
            {
              ...transit,
              delay: stagger(staggerDelay),
            },
          ],
          [
            "li",
            { y: 0 },
            {
              // ...transit,
              delay: stagger(staggerDelay),
            },
          ],
        ],
        {
          repeat: Infinity,
          type: "spring",
          mass: 1,
          // type: "spring",
          // stiffness: 1000,
        }
      );
    }
  }, [tarotHand]);

  return (
    <motion.ul className="flex flex-wrap my-[30px] flex-1 justify-center">
      {tarotHand
        ? tarotHand?.map((data: CardType, index: number) => (
            <motion.li key={index}>
              <Card id={"t-card"} data={index < visibleCards ? data : null} />
            </motion.li>
          ))
        : emptyArray?.map((data: any, index: number) => {
            return <Card key={index} data={data} />;
          })}
    </motion.ul>
  );
}
