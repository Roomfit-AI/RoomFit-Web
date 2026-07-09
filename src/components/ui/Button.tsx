import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}

export default function Button({ children, onClick, className = "" }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)] transition-colors hover:bg-[#2a2a2a] ${className}`}
    >
      {children}
    </button>
  );
}
