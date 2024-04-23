import { ReactNode } from "react";

type Props = {
  id: string;
  onClick?: any;
  children: ReactNode;
  loading: boolean;
};

export const DialogButton = ({ id, onClick, children, loading }: Props) => (
  <button
    id={id}
    className="my-8 bg-brown_01 h-[50px] w-[200px] p-2 text-brown_02 rounded-md font-sans hover:opacity-80"
    onClick={onClick}
  >
    {loading ? "loading" : children}
  </button>
);
