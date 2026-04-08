import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:8585'),
  title: 'System Benchmark Dashboard',
  description: 'Stress-test local LLM inference on Linux workstations — real-time GPU/CPU monitoring, benchmark execution, and historical analysis.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'System Benchmark Dashboard',
    description: 'Stress-test local LLM inference — real-time GPU/CPU monitoring and benchmark execution.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
      </head>
      <body className="bg-[#0D0E1A] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}