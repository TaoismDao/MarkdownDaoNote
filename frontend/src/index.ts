import "./styles.css";
import { EditorApp } from "./components/EditorApp";

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("app");
  if (!mount) {
    throw new Error("App root element not found");
  }

  const app = new EditorApp(mount);
  app.bootstrap();
});
