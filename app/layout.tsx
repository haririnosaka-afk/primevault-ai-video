import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'PRIMEVAULT AI VIDEO', description: 'Seedance video generation powered by RunningHub' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="id"><body>{children}</body></html>;
}
