import "./globals.css";

export const metadata = {
  title: "Brew-Ledger",
  description: "Brew-Ledger bar stock operations"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
