import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OrderPilot AI — Owner Dashboard",
  description: "Self-running WhatsApp operations agent for small WooCommerce businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fafafa" }}>{children}</body>
    </html>
  );
}
