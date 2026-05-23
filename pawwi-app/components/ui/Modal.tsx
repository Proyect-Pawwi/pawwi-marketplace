"use client";

import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max width of the dialog. Default: max-w-lg */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  // Close on backdrop click
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedOutside) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      onClose={onClose}
      className={[
        "w-full rounded-2xl bg-white p-6 shadow-xl",
        "backdrop:bg-midnight/40 backdrop:backdrop-blur-sm",
        "open:animate-[fadeIn_0.15s_ease-out]",
        sizeClasses[size],
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        {title && (
          <h2 className="text-lg font-semibold text-midnight font-heading leading-snug">
            {title}
          </h2>
        )}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="ml-auto shrink-0 rounded-full p-1.5 text-midnight/40 hover:text-midnight hover:bg-midnight/8 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}

export { Modal };
export type { ModalProps };
