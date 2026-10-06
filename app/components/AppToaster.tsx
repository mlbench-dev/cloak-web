"use client";

import { useRef, useState, type PointerEvent } from "react";
import {
  ToastBar,
  Toaster,
  resolveValue,
  toast,
  type Toast,
} from "react-hot-toast";

// How far a toast has to be dragged sideways before letting go dismisses it.
const SWIPE_DISMISS_PX = 70;
const FLY_OUT_MS = 180;

// Wraps the library's own ToastBar (so icons, enter/exit animation and
// per-toast options keep working) in a horizontally draggable container.
// Loading toasts aren't swipeable — they're dismissed by the code that
// started them, and swiping one away would hide an in-flight operation.
function SwipeableToast({ t }: { t: Toast }) {
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const canSwipe = t.type !== "loading";

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canSwipe) return;
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    setOffset(e.clientX - startX.current);
  };

  const handlePointerEnd = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);

    if (Math.abs(offset) < SWIPE_DISMISS_PX) {
      setOffset(0);
      return;
    }

    // Let it fly off in the direction it was thrown, then drop it without
    // the library's own exit animation (it's already off screen).
    setOffset(Math.sign(offset) * window.innerWidth);
    setTimeout(() => toast.remove(t.id), FLY_OUT_MS);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{
        transform: `translateX(${offset}px)`,
        opacity: Math.max(0, 1 - Math.abs(offset) / 220),
        transition: dragging
          ? "none"
          : `transform ${FLY_OUT_MS}ms ease-out, opacity ${FLY_OUT_MS}ms ease-out`,
        // Vertical drags still scroll the page; horizontal ones are ours.
        touchAction: "pan-y",
        cursor: canSwipe ? "grab" : "default",
        userSelect: "none",
        // Full device width (the Toaster keeps a 16px gutter each side),
        // capped at the app's own 430px column on wider screens.
        width: "100%",
        maxWidth: 398,
      }}
    >
      <ToastBar toast={t} position={t.position || "top-center"}>
        {({ icon }) => (
          <>
            {icon}
            {/* Rendered here instead of the library's own message element,
                which centers its text. */}
            <div
              {...t.ariaProps}
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                marginLeft: 10,
                textAlign: "left",
                whiteSpace: "pre-line",
                overflowWrap: "anywhere",
              }}
            >
              {resolveValue(t.message, t)}
            </div>
          </>
        )}
      </ToastBar>
    </div>
  );
}

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        // Frosted glass. The app's pages are white, so a mostly-white fill
        // just reads as a white card — the fill is kept well under 50%
        // with a faint teal tint, and the hairline + shadow give the pane
        // an edge even when there's nothing colourful behind it to blur.
        style: {
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(214, 248, 250, 0.32) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow:
            "0 10px 34px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.75)",
          color: "#2B2B2B",
          borderRadius: "20px",
          fontSize: "14px",
          lineHeight: "20px",
          fontWeight: "400",
          padding: "12px 16px",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        },
        success: {
          iconTheme: {
            primary: "#01C3CF",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#FC383A",
            secondary: "#fff",
          },
        },
      }}
    >
      {(t) => <SwipeableToast t={t} />}
    </Toaster>
  );
}
