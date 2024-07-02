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
  index: number;
  data?: CardType | null;
  reveal?: boolean;
  setReveal: (value: number) => void;
}

export default function Card(props: Props) {
  const [showCardFace, setShowCardFace] = useState<boolean>(false);
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
    if (!reveal) {
      props.setReveal(props?.index);
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

  return !!data ? (
    <>
      {reveal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 4, delay: 1 } }}
          exit={{ opacity: 0, transition: { duration: 3 } }}
          className="z-0 h-[28rem] w-[16rem] top-0 left-2 px-4 py-1 absolute bg-brown_04 flex flex-col justify-end rounded-md"
        >
          <div className="text-brown_02 align-center font-sans">
            {data?.name}
          </div>
        </motion.div>
      )}
      <motion.div
        {...props}
        whileHover={{ y: -10, transition: { ...transit } }}
        className="relative sm:h-[15rem] md:h-[25rem] sm:w-[9rem] md:w-[15rem] lg: w-[15rem] p-4 m-4 bg-white br-4  align-center justify-center rounded-md z-50"
        onClick={revealCard}
        ref={cardRef}
      >
        <motion.div className="relative">
          <Image
            width={300}
            height={500}
            className="h-[23rem] w-[13.2rem]"
            src={"/assets/cards/" + data?.image}
            alt={data?.name}
          />
          <AnimatePresence initial={false}>
            {!reveal && (
              <motion.img
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                  transition: { type: "spring", duration: "10" },
                }}
                width={300}
                height={500}
                className="h-[23rem] w-[13rem] absolute top-0"
                src={"/assets/cards/CardBack.png"}
                alt={data?.name}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  ) : null;
}
