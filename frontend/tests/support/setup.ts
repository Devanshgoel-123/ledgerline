import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterEach } from "vitest";

// Tests check what renders, not how it moves. With animations on, Motion runs native
// animations and cancels them when a test unmounts, which rejects promises no one handles.
MotionGlobalConfig.skipAnimations = true;

// Vitest globals are off, so Testing Library cannot register this itself. Without it,
// rendered trees outlive their test file and React work can run after the DOM is gone.
afterEach(() => cleanup());
