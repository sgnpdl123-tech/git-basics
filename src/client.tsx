import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";

const router = getRouter();

const container = document;

startTransition(() => {
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});

// Load initial route state non-blocking after first paint
void router.load();
