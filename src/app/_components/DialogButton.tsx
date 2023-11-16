import { ReactNode } from "react";

type Props = {
  onClick: any;
  children: ReactNode;
};

export const DialogButton = ({ onClick, children }: Props) => (
  <button
    className="my-8 bg-brown_01 p-4 text-brown_02 rounded-md"
    onClick={onClick}
  >
    {children}
  </button>
);
