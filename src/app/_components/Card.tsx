"use client";
import { CardType } from "@/types";
import { trpc } from "../_trpc/client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { motion, animate, stagger, HTMLMotionProps } from "framer-motion";

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

  const stageDuration = 0.01;
  const staggerDelay = 0.1;

  const transit = {
    duration: stageDuration,
    type: "spring",
    mass: 0.9,
    // stiffness: 1000,
  };

  useEffect(() => {
    // animate(
    //   [
    //     [
    //       "li",
    //       { y: 0 },
    //       {
    //         ...transit,
    //         delay: 0,
    //       },
    //     ],
    //     [
    //       "li",
    //       { y: -30 },
    //       {
    //         ...transit,
    //         delay: stagger(staggerDelay, { ease: (p) => Math.sin(p) }),
    //       },
    //     ],
    //     [
    //       "li",
    //       { y: 0 },
    //       {
    //         ...transit,
    //         delay: stagger(staggerDelay, { ease: (p) => Math.sin(p) }),
    //       },
    //     ],
    //   ],
    //   {
    //     repeat: 2,
    //     delay: 0,
    //     // type: "spring",
    //     // stiffness: 1000,
    //   }
    // );
  }, []);

  const revealCard = () => {
    const targetId = "." + id;
    console.log("targetId in reveal card: ", targetId);
    if (!manualReveal) {
      setTimeout(() => {
        setManualReveal(true);
      }, 1300);
      animate(
        [
          [
            cardRef.current,
            { y: -30 },
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

  const width = 80;

  const height = (3 / 5) * 80;
  return !!data ? (
    <motion.div
      {...props}
      className="sm:h-[15rem] md:h-[25rem] sm:w-[9rem] md:w-[15rem] lg: w-[15rem] p-4 m-4 bg-white br-4  align-center justify-center rounded-md"
      onClick={revealCard}
      ref={cardRef}
    >
      <Image
        width={300}
        height={500}
        className="h-[22rem] w-[13.2rem]"
        src={
          reveal || manualReveal
            ? "/assets/cards/" + data?.image
            : "/assets/cards/CardBack.png"
        }
        alt={data?.name}
      />
      <div className="text-black align-center font-sans">{data?.name}</div>
    </motion.div>
  ) : null;
}
