import type { ReactNode } from "react";
import AppShell from "@/components/app/Sidebar";

export const metadata = { title: "Doom Market — App" };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
