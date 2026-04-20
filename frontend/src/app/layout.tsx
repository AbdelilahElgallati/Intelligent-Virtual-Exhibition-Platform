import type { Metadata } from "next";
import i18next from "i18next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ClientLayout } from "@/components/layout/ClientLayout";
import en from "../../messages/en.json";

const metadataI18n = i18next.createInstance();
void metadataI18n.init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
  initImmediate: false,
});

export const metadata: Metadata = {
  title: metadataI18n.t("layout.metadata.title"),
  description: metadataI18n.t("layout.metadata.description"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased">
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
