"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { tr, type Lang, type TKey } from "@/lib/translations";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

function applyLang(l: Lang) {
  document.documentElement.setAttribute("lang", l);
  document.documentElement.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    const initial: Lang = saved && ["en", "fr", "ar"].includes(saved) ? (saved as Lang) : "en";
    setLangState(initial);
    applyLang(initial);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("lang", l);
    applyLang(l);
  }

  const t = (key: TKey, vars?: Record<string, string | number>) => tr(lang, key, vars);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
