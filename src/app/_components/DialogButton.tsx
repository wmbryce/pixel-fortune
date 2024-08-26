import { ReactNode } from "react";

type Props = {
  id: string;
  onClick?: any;
  children: ReactNode;
  loading: boolean;
  disabled?: boolean;
};

export const DialogButton = ({
  id,
  onClick,
  children,
  loading,
  disabled,
}: Props) => (
  <button
    id={id}
    className="bg-brown_01 h-[50px] w-[200px] p-2 text-brown_02 rounded-md font-sans hover:opacity-80"
    onClick={onClick}
    disabled={disabled}
  >
    {loading ? "loading" : children}
  </button>
);
