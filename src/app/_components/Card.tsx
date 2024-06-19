"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import {
  motion,
  animate,
  stagger,
  HTMLMotionProps,
  AnimatePresence,
} from "framer-motion";

interface Props extends HTMLMotionProps<"div"> {
  id: string;
  data?: CardType | null;
  reveal?: boolean;
}

export default function Card(props: Props) {
  const [showCardFace, setShowCardFace] = useState<boolean>(false);
  const [manualReveal, setManualReveal] = useState<boolean>(false);
  const cardRef = useRef(null);

  const { id, data, reveal } = props;

  const stageDuration = 0.2;
  const staggerDelay = 0.1;

  const transit = {
    duration: stageDuration,
    type: "spring",
    // damping: 4,
    // mass: 0.9,
    // stiffness: 1000,
  };

  const revealCard = () => {
    const targetId = "." + id;
    if (!manualReveal) {
      setTimeout(() => {
        setManualReveal(true);
      }, 400);
      animate(
        [
          [
            cardRef.current,
            { y: 10 },
            {
              ...transit,
              // delay: stagger(staggerDelay, { ease: (p) => Math.sin(p) }),
            },
          ],
          [
            cardRef.current,
            { y: 0 },
            {
              ...transit,
              // delay: stagger(staggerDelay, { ease: (p) => Math.sin(p) }),
            },
          ],
        ],
        {
          repeat: 0,
          delay: 0,
          // type: "spring",
          // stiffness: 1000,
        }
      );
    }
  };

  console.log("manual reveal: ", manualReveal);
  return !!data ? (
    <motion.div
      {...props}
      whileHover={{ y: -10, transition: { ...transit } }}
      className="sm:h-[15rem] md:h-[25rem] sm:w-[9rem] md:w-[15rem] lg: w-[15rem] p-4 m-4 bg-white br-4  align-center justify-center rounded-md"
      onClick={revealCard}
      ref={cardRef}
    >
      <motion.div className="relative">
        <Image
          width={300}
          height={500}
          className="h-[22rem] w-[13.2rem]"
          src={"/assets/cards/" + data?.image}
          alt={data?.name}
        />
        <div className="text-black align-center font-sans">{data?.name}</div>
        <AnimatePresence>
          {!manualReveal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Image
                width={300}
                height={500}
                className="h-[23.4rem] w-[16.2rem] absolute top-0"
                src={"/assets/cards/CardBack.png"}
                alt={data?.name}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  ) : null;
}
