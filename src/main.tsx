import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { AnimatePresence } from "framer-motion";
import App from "./App";
import "./styles.css";
import { I18nProvider } from "./i18n";
import { useLicense } from "./store/useLicense";
import { useAuth } from "./store/useAuth";
import { Splash } from "./components/Splash";

const SPLASH_MS = 2400;

function Root() {
  const refresh = useLicense((s) => s.refresh);
  const initAuth = useAuth((s) => s.init);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    refresh();
    initAuth();
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [refresh, initAuth]);

  return (
    <>
      <App />
      <AnimatePresence>{showSplash && <Splash />}</AnimatePresence>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>,
);
