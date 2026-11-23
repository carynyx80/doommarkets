import type { Metadata } from "next";
import DeployContract from "./DeployContract";

export const metadata: Metadata = {
  title: "Deploy contract — Doom Market",
  robots: { index: false, follow: false },
};

export default function DeployPage() {
  return <DeployContract />;
}
