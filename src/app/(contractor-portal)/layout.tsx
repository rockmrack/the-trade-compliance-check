import { Shield } from 'lucide-react';
import Link from 'next/link';

export default function ContractorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/contractor" className="flex items-center gap-2">
              <Shield className="h-7 w-7 text-green-600" />
              <span className="font-bold text-lg">Contractor Portal</span>
            </Link>
            <div className="text-sm text-muted-foreground">
              Trade Compliance Engine
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-900 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Trade Compliance Engine. All rights reserved.</p>
          <p className="mt-1">
            <Link href="/verify" className="text-primary hover:underline">
              Public Verification Portal
            </Link>
            {' · '}
            <Link href="/login" className="text-primary hover:underline">
              Admin Login
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
