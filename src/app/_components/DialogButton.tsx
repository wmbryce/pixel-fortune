import { ReactNode, Ref } from 'react';

type Props = {
  id?: string;
  ref?: Ref<HTMLButtonElement>;
  onClick?: () => void;
  children: ReactNode;
  loading: boolean;
  disabled?: boolean;
};

export const DialogButton = ({
  id,
  ref,
  onClick,
  children,
  loading,
  disabled,
}: Props) => (
  <button
    id={id}
    ref={ref}
    type="button"
    // The dark brown ring on the box's light face. A hover dim was all this
    // control had to say it was being addressed, and a dim is not something a
    // keyboard can cause.
    className="bg-brown_01 h-[50px] w-[200px] p-2 text-brown_02 rounded-md font-sans hover:opacity-80 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown_03"
    onClick={onClick}
    disabled={disabled}
  >
    {loading ? 'loading' : children}
  </button>
);
