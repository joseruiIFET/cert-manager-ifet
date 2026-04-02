/* ARQUIVO: src/app/layout.js */
import "./globals.css";

export const metadata = {
  title: "Cert Manager",
  description: "Gerenciador de Certificados",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}