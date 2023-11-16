import React, { useEffect } from "react";
import Image from "next/image";

type Props = {
  setShowWelcome: any;
};

function Welcome({ setShowWelcome }: Props) {
  useEffect(() => {
    setTimeout(() => {
      setShowWelcome(false);
    }, 3000);
  });

  return (
    <Image
      height={400}
      width={400}
      className="flex object-contain animate-fade h-[700px] w-[1000px]"
      src={"/assets/introImage2.png"}
      alt={"Welcome image"}
    />
  );
}

export default Welcome;
