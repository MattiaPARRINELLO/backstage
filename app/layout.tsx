import type { Metadata, Viewport } from "next";
import { createElement } from "react";
import { Inter, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ModuleActionsProvider, ModuleHomeCardProvider, ModulePanelProvider, type ModulePanel } from "@backstage/module-kit";
import "./globals.css";
import { PwaLoader } from "@/components/ui/PwaLoader";
import { ThemeApplier } from "@/components/ui/ThemeApplier";
import { ViewTransitionProvider } from "@/components/ViewTransitionProvider";
import { callModuleAction } from "@/app/m/actions";
import { moduleHomeCardItems } from "@/lib/kernel/module-home";
import { modulePanelItems } from "@/lib/kernel/module-panel";
import { registry } from "@/lib/kernel/registry";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Titre de la landing uniquement (programme de salle / affiche).
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BACKSTAGE · Second Brain IA",
  description:
    "Second cerveau IA pour le code, la photo et la mémoire.",
  manifest: "/manifest.json",
  // Le favicon vient de `app/favicon.ico` (convention Next, multi-tailles).
  // Ne jamais remettre de <link rel="icon"> manuel : il avait priorite sur
  // l'icone .ico et servait un PNG 540x880, donc un favicon ecrase.
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BACKSTAGE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
  interactiveWidget: "resizes-content",
};

/**
 * Panneaux et cartes d'accueil des modules actifs, montes dans le plus proche
 * ancetre serveur commun a toutes les pages. Le chrome client les recoit par
 * contexte ; il n'importe donc jamais le registre (ADR 0001, decision G).
 */
function modulePanels(): ModulePanel[] {
  return modulePanelItems(registry).map((item) => ({
    id: item.id,
    label: item.label,
    node: (
      <ModuleActionsProvider moduleId={item.id} call={callModuleAction}>
        {createElement(item.component)}
      </ModuleActionsProvider>
    ),
  }));
}

function moduleHomeCards() {
  return moduleHomeCardItems(registry).map((item) => ({
    id: item.id,
    node: (
      <ModuleActionsProvider moduleId={item.id} call={callModuleAction}>
        {createElement(item.component)}
      </ModuleActionsProvider>
    ),
  }));
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        {/* Thème avant peinture : suit le système, sauf choix enregistré. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var s=localStorage.getItem("pb-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var def=location.pathname==="/"?(d?"dark":"light"):"dark";document.documentElement.dataset.theme=(s==="light"||s==="dark")?s:def}catch(e){}})();',
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="application-name" content="BACKSTAGE" />
      </head>
      <body className="min-h-full relative font-sans">
        <PwaLoader />
        <ThemeApplier />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-2 focus:rounded-[var(--r-sm)] focus:bg-[var(--surface-1)] focus:border focus:border-[var(--border-2)] focus:text-[var(--text-1)] focus:text-[length:var(--t-small)]"
        >
          Aller au contenu
        </a>
        <ViewTransitionProvider>
          <ModuleHomeCardProvider cards={moduleHomeCards()}>
            <ModulePanelProvider panels={modulePanels()}>{children}</ModulePanelProvider>
          </ModuleHomeCardProvider>
        </ViewTransitionProvider>
      </body>
    </html>
  );
}
