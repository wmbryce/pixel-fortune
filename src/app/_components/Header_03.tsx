import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  onClick?: any;
};

function Header_03({ children, className, onClick }: Props) {
  return (
    <h1
      onClick={onClick}
      className={
        !!className
          ? "text-white font-sans font-bold cursor-pointer" + className
          : "text-white font-sans font-bold cursor-pointer"
      }
    >
      {children}
    </h1>
  );
}

export default Header_03;
