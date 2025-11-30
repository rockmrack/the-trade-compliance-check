import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, Building2, FileCheck, Bell, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-green-500" />
            <span className="text-xl font-bold">Trade Compliance Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/verify">
              <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                Verify a Contractor
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-green-600 hover:bg-green-700">
                Sign In
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-400">Enterprise-Grade Compliance</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Never Risk{' '}
            <span className="text-green-500">Uninsured</span>{' '}
            Contractors Again
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Automate compliance verification, block payments to non-compliant sub-contractors,
            and give your clients a tool to verify any tradesperson instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/verify">
              <Button size="xl" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                <Shield className="mr-2 h-5 w-5" />
                Verify a Contractor
              </Button>
            </Link>
            <Link href="/login">
              <Button size="xl" variant="outline" className="border-slate-600 text-white hover:bg-white/10 w-full sm:w-auto">
                Access Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<FileCheck className="h-8 w-8" />}
            title="AI Document Verification"
            description="Our AI scans insurance certificates to extract expiry dates, coverage amounts, and detect signs of tampering or fraud."
          />
          <FeatureCard
            icon={<Building2 className="h-8 w-8" />}
            title="Companies House Integration"
            description="Real-time verification against Companies House to ensure companies are active and haven't gone into liquidation."
          />
          <FeatureCard
            icon={<Bell className="h-8 w-8" />}
            title="Automated Reminders"
            description="WhatsApp and email reminders chase contractors automatically when their documents are expiring."
          />
          <FeatureCard
            icon={<Lock className="h-8 w-8" />}
            title="Payment Protection"
            description="Automatically block payments to contractors with expired insurance, protecting you from liability."
          />
          <FeatureCard
            icon={<CheckCircle2 className="h-8 w-8" />}
            title="Public Verification"
            description="Give homeowners and architects a tool to verify any contractor's compliance status instantly."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="Audit Trail"
            description="Complete audit log of all verification checks, document uploads, and compliance decisions."
          />
        </div>

        {/* CTA */}
        <div className="mt-32 text-center">
          <div className="inline-block p-8 rounded-2xl bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/20">
            <h2 className="text-3xl font-bold mb-4">Ready to Protect Your Business?</h2>
            <p className="text-slate-300 mb-6 max-w-xl">
              Join leading construction and renovation companies who trust our platform
              to manage contractor compliance.
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-32 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} Trade Compliance Engine. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-500/10 text-green-500 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
