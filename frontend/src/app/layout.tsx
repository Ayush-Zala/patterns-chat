import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Patterns Chat — Quality. Delivered. | Team Collaboration & Chat',
  description:
    'Patterns Chat brings your team, conversations, and tools into one powerful workspace. Chat, meet, share and get things done — all in one place.',
  icons: {
    icon: [
      { url: '/patterns-icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/patterns-icon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/patterns-icon.png',
    apple: '/patterns-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 selection:bg-indigo-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
