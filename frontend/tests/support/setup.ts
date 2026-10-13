import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library cannot register this itself. Without it,
// rendered trees outlive their test file and React work can run after the DOM is gone.
afterEach(() => cleanup());
