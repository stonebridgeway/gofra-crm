import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CrmApp } from "../app/crm/CrmApp";
import { ThemeProvider } from "../app/crm/theme";
import "../app/globals.css";
import "../app/agency-redesign.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Не найден корневой элемент приложения.");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <CrmApp />
    </ThemeProvider>
  </StrictMode>,
);
