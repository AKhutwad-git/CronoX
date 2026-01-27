import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof localStorage !== "undefined") {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("cronox.token");
}

createRoot(document.getElementById("root")!).render(<App />);
