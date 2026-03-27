import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "You Don't Know Jack",
  description:
    'A multiplayer trivia game where high culture and pop culture collide.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <div className="crt-overlay" />
        {children}
      </body>
    </html>
  );
}
