import { Metadata } from 'next';
import { VerificationSearch } from '@/components/verify/verification-search';

export const metadata: Metadata = {
  title: 'Verify a Contractor',
  description:
    'Check if a contractor is verified and has valid insurance and certifications.',
  openGraph: {
    title: 'Verify a Contractor | Trade Compliance Engine',
    description:
      'Instantly verify if a contractor has valid insurance and certifications before hiring.'
  }
};

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Verify a Contractor
          </h1>
          <p className="mt-4 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Check if a contractor is registered with us and has valid insurance
            and certifications before you hire them.
          </p>
        </div>

        {/* Search Component */}
        <VerificationSearch />

        {/* Trust Indicators */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <TrustIndicator
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            title="Insurance Verified"
            description="We verify public liability and employer's liability insurance directly with providers."
          />
          <TrustIndicator
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
            title="Companies House Linked"
            description="Real-time company status checks against the official Companies House register."
          />
          <TrustIndicator
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            }
            title="AI Fraud Detection"
            description="Advanced AI analysis checks documents for signs of tampering or fraud."
          />
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FAQItem
              question="What does 'Verified Partner' mean?"
              answer="A Verified Partner is a contractor who has submitted all required documentation, passed our verification checks, and maintains current insurance and certifications. We continuously monitor their compliance status."
            />
            <FAQItem
              question="How current is the information?"
              answer="Insurance and certification statuses are checked daily. Companies House data is refreshed every 24 hours. If a contractor's documents expire, their status is updated immediately."
            />
            <FAQItem
              question="What if a contractor isn't found?"
              answer="If a contractor doesn't appear in our system, it means they haven't registered with us yet. This doesn't necessarily mean they're not legitimate - they simply may not have gone through our verification process."
            />
            <FAQItem
              question="How do I register as a contractor?"
              answer="Contractors can register through our partner portal. Contact us for an invitation to join our verified contractor network."
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-20 py-8 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>
            This verification tool is provided for informational purposes only.
            Always conduct your own due diligence before hiring any contractor.
          </p>
          <p className="mt-2">
            &copy; {new Date().getFullYear()} Trade Compliance Engine. All
            rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

function TrustIndicator({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
        {question}
      </h3>
      <p className="text-slate-600 dark:text-slate-400">{answer}</p>
    </div>
  );
}
