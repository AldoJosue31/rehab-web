// apps/patient/src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // si existe; no es obligatorio

const container = document.getElementById("root");
createRoot(container).render(<App />);
