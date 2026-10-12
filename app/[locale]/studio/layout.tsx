import type {ReactNode} from "react";
import {StudioAccountProvider} from "@/components/studio/StudioAccount";
import {authConfig} from "@/lib/auth/config";
import {getCurrentUser} from "@/lib/auth/server";
import "@/components/studio/studio.css";

export const metadata = {robots: {index: false, follow: false}};

export default async function StudioLayout({children, params}: {children: ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <div className="studio-redesign"><StudioAccountProvider initialUser={await getCurrentUser()} configured={Boolean(authConfig())} locale={locale}>
    {children}
  </StudioAccountProvider></div>;
}
