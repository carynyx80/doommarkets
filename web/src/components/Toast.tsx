"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "info" | "success" | "error";
interface T {
  id: number;
  title: string;
  body?: string;
  kind: Kind;
  link?: ToastLink;
}
export interface ToastLink {
  href: string;
  label: string;
}

const Ctx = createContext<(title: string, body?: string, kind?: Kind, link?: ToastLink) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((title: string, body?: string, kind: Kind = "info", link?: ToastLink) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, title, body, kind, link }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), link ? 9000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="glass pointer-events-auto rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    t.kind === "success" ? "bg-acid" : t.kind === "error" ? "bg-doom" : "bg-white/60"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-white">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-xs text-white/55">{t.body}</p>}
                  {t.link && (
                    <a href={t.link.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-acid underline-offset-2 hover:underline">
                      {t.link.label} ↗
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
