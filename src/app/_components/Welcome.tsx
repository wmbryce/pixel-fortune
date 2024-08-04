import React, { useEffect } from "react";
import Image from "next/image";

type Props = {};

function Welcome({}: Props) {
  return (
    <div className="relative w-full h-full">
    <Image
      fill
      className="object-contain animate-fadeIn"
      src={"/assets/background/welcome_image.png"}
      alt={"Pixel Fortune"}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      priority
      />
    </div>
  );
}

export default Welcome;
