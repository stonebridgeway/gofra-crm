import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "ГОФРА CRM",
      template: "%s · ГОФРА CRM",
    },
    description:
      "Frontend-only CRM для продаж гофроупаковки: клиенты, сделки, контакты, история и импорт.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      title: "ГОФРА CRM",
      description:
        "Клиенты, сделки, контакты, история, импорт и справочники в одном CRM-прототипе.",
      images: [
        {
          url: "/og.png",
          width: 1680,
          height: 941,
          alt: "ГОФРА CRM — канбан клиентов и сделок",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "ГОФРА CRM",
      description:
        "Frontend-only CRM с полным набором клиентских и сделочных статусов.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
