
"use client";

import { useLayoutEffect } from "react";

export default function ViewportHeightSetter() {
  useLayoutEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
      // iOS Safari doesn't shrink the page when the keyboard opens — it
      // scrolls it to keep the input visible. The app shrinks to the visible
      // height above, so it must also move down by that scroll, or the body
      // background shows as a gap between the app and the keyboard.
      const top = Math.max(0, window.visualViewport?.pageTop ?? 0);
      document.documentElement.style.setProperty("--app-top", `${top}px`);
    };

    setHeight();

    window.visualViewport?.addEventListener("resize", setHeight);
    window.visualViewport?.addEventListener("scroll", setHeight);
    window.addEventListener("resize", setHeight);
    window.addEventListener("orientationchange", setHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setHeight);
      window.visualViewport?.removeEventListener("scroll", setHeight);
      window.removeEventListener("resize", setHeight);
      window.removeEventListener("orientationchange", setHeight);
    };
  }, []);

  return null;
}
