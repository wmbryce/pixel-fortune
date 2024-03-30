import React, { useEffect } from "react";
import Image from "next/image";

type Props = {};

function Welcome({}: Props) {
  return (
    <Image
      height={600}
      width={600}
      className="flex object-contain animate-fadeIn h-[900px] w-[1200px]"
      src={"/assets/Background/MainImage.png"}
      alt={"Pixel Fortune"}
    />
  );
}

export default Welcome;
