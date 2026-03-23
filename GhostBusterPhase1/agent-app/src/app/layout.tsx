import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'GhostBuster Agent Ops',
  description: 'Browser observer + auto-fix pipeline built on Vercel AI, Clerk, and Supabase.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
