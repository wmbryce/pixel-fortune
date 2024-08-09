"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Card from "./Card";
import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, stagger } from "framer-motion";
import { randomInt } from "crypto";

type Props = {
  tarotHand?: CardType[];
  setAllRevealed: (revealed: boolean) => void;
};

export default function CardTable({ tarotHand, setAllRevealed }: Props) {
  const [visibleCards, setVisibleCards] = useState<number>(-1);
  const emptyArray = [null, null, null, null, null];

  const [revealedCards, setRevealedCards] = useState([
    false,
    false,
    false,
    false,
    false,
  ]);

  useEffect(() => {
    if (!!tarotHand?.length && tarotHand?.length > 0) {
      if (visibleCards < 6) {
        setTimeout(() => {
          setVisibleCards(visibleCards + 1);
        }, 400);
      }
    } else {
      setVisibleCards(0);
      setRevealedCards([false, false, false, false, false]);
    }
  }, [tarotHand, visibleCards]);

  useEffect(() => {
    if (!revealedCards.includes(false)) {
      setAllRevealed(true);
    }
  }, [revealedCards, setAllRevealed]);

  useEffect(() => {
    console.log("start animation");
  }, [tarotHand]);

  const UpdateRevealCard = (index: number) => {
    console.log("update reveal card: ", index);
    const newRevealedCards = [...revealedCards];
    newRevealedCards[index] = true;
    setRevealedCards(newRevealedCards);
  };

  return (
    <motion.ul layout className="flex flex-wrap my-[30px] flex-1">
      <div className="flex flex-wrap flex-1 justify-center">
        <AnimatePresence>
          {tarotHand
            ?.slice(0, visibleCards)
            .map((data: CardType, index: number) => (
              <motion.li
                key={index}
                layoutId={"card-" + index}
                className="relative"
                initial={{ y: -500 }}
                animate={{
                  y: 0,
                  transition: { type: "spring", duration: "1" },
                }}
              >
                <Card
                  id={"t-card-" + index}
                  index={index}
                  reveal={revealedCards?.[index]}
                  setReveal={UpdateRevealCard}
                  data={index < visibleCards ? data : null}
                />
              </motion.li>
            ))}
        </AnimatePresence>
      </div>
    </motion.ul>
  );
}
