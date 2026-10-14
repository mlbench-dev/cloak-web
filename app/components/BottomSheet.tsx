"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Keep in sync with the duration-300 classes below.
const TRANSITION_MS = 300;

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  // Centered heading with a divider underneath, like the app's other sheets.
  title?: string;
  // Defaults to showing the X whenever there's a title.
  showCloseButton?: boolean;
  // Tapping the backdrop / pressing Escape closes the sheet. Turn off while
  // a request is in flight so the user can't dismiss mid-submit.
  dismissible?: boolean;
  // Extra classes for the white panel (height caps, overflow, shadow…).
  panelClassName?: string;
  // Called once the close animation has finished. Use it when the parent
  // unmounts the sheet itself, so it can wait for the slide-down first.
  onExited?: () => void;
};

export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  showCloseButton = Boolean(title),
  dismissible = true,
  panelClassName = "",
  onExited,
}: BottomSheetProps) {
  // `mounted` keeps the sheet in the DOM through its exit animation;
  // `entered` flips a frame after mount so the slide-up actually transitions
  // instead of painting already in place.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  if (open && !mounted) setMounted(true);

  const onExitedRef = useRef(onExited);
  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  useEffect(() => {
    if (open && mounted) {
      // Two frames: the first commits the off-screen position, the second
      // starts the transition from it.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    if (!open && mounted) {
      const timeout = setTimeout(() => {
        setMounted(false);
        setEntered(false);
        onExitedRef.current?.();
      }, TRANSITION_MS);
      return () => clearTimeout(timeout);
    }
  }, [open, mounted]);

  // Lock page scroll for as long as the sheet is on screen.
  useEffect(() => {
    if (!mounted) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, dismissible, onClose]);

  if (!mounted) return null;

  const visible = open && entered;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full rounded-t-[30px] bg-white pt-2.5 font-sf-pro-display transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none ${
          visible ? "translate-y-0" : "translate-y-full"
        } ${panelClassName}`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[#E0E0E0]" />
        {title ? (
          <>
            <div className="relative mt-3.5 px-4">
              <h3 className="text-center text-[16px] font-medium leading-[22px] text-[#2B2B2B]">
                {title}
              </h3>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute -top-[7px] right-2 flex h-9 w-9 items-center justify-center rounded-full text-[#839297]"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="mx-4 mt-3.5 border-t border-[#E7E7E7]" />
          </>
        ) : (
          showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-2 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[#839297]"
            >
              <X className="h-5 w-5" />
            </button>
          )
        )}
        {children}
      </div>
    </div>
  );
}
