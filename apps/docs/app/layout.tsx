import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import './global.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runtime font fetch (browser-side <link>), not a build-time fetch —
          matches apps/dashboard/src/client/index.html. next/font/google was
          deliberately avoided here: it fetches over the network during
          `next build`, which is unreliable in the Docker build environment
          (see task-1-report.md).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
