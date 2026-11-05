import type { Metadata } from 'next';
import '@lenati/config/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lenati',
  description: 'An encyclopedia you can walk into. Start with the human body, from the whole person down to a single histone.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
