import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ต้นไม้แห่งความหวัง',
  description: 'เกมระดมความคิดแบบเรียลไทม์ — ร่วมกันปลูกต้นไม้แห่งความหวัง',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <main id="main-content">{children}</main>
        <footer className="app-footer">
          <div>By ศิลา ปลาเผา</div>
        </footer>
      </body>
    </html>
  );
}
