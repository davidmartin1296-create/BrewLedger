import "./globals.css";

export const metadata = {
  title: "Brew-Ledger",
  description: "Brew-Ledger bar stock operations"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <div className="app-background" aria-hidden="true" />
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
