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
  const backgroundRef = useRef(null);

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
          [
            backgroundRef.current,
            {
              backgroundColor: "rgba(165, 42, 42, 0.7)",
            },
            { 
            backgroundColor: "rgba(165, 42, 42, 0.7)",
            transition: { duration: 0.5 } 
            }
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

  const backgroundVariants = {
    hidden: { backgroundColor: "#0B001200" },
    visible: { backgroundColor: "#0B0012B0" },
  };

  const textVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return !!data ? (
        <motion.div
          id={"background."+ id}
          variants={backgroundVariants}
          initial="hidden"
          animate={reveal ? "visible" : "hidden"}
          className="z-0 top-0 left-2 p-2 bg-brown_04 flex flex-col justify-end rounded-md m-1 sm:m-2 md:m-3 lg:m-4 p-3"
      >
      <motion.div
        {...props}
        whileHover={{ y: -10, transition: { ...transit } }}
        // className="relative md:h-[25rem] sm:w-[9rem] md:w-[15rem] lg: w-[15rem] p-4 m-4 bg-white br-4  align-center justify-center rounded-md z-50"
        onClick={revealCard}
        ref={cardRef}
        className="relative bg-white rounded-md w-full h-full p-2"
      >
        <motion.div className="relative
          w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60
          ">
          <Image
            fill
            className="object-cover rounded-sm"
            src={"/assets/cards/" + data?.image}
            alt={data?.name}
        />
          <AnimatePresence initial={false}>
            {!reveal && (
                <motion.div
                  initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { type: "spring", duration: 1 } }}
                className="absolute inset-0"
              >
                <Image
                  fill
                  className="object-cover rounded-md"
                  src="/assets/cards/CardBack.png"
                  alt="Card Back"
                  sizes="(max-width: 640px) 6rem, (max-width: 768px) 8rem, (max-width: 1024px) 10rem, 12rem"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
          <motion.div className="text-brown_02 align-center font-sans" variants={textVariants} initial="hidden" animate={reveal ? "visible" : "hidden"}>
            {data?.name}
          </motion.div>
        </motion.div>
  ) : null;
}

