import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

// Template Terms of Service for NearScene's beta period.
// Covers user-generated content rules, liability disclaimer, and ToS for the
// beta period. Have a lawyer review before exiting beta / accepting payments.
export default function TermsPage() {
  const lastUpdated = 'May 4, 2026';

  return (
    <div className="min-h-screen bg-background" data-testid="terms-page">
      <div className="container mx-auto max-w-3xl px-4 md:px-6 py-12">
        <Button variant="ghost" size="sm" className="mb-6" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to NearScene
          </Link>
        </Button>

        <h1 className="font-heading text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">1. Welcome — and what this is</h2>
            <p>
              NearScene is a local-discovery web app currently in beta, focused on the
              Wilmington, NC area. By creating an account or using the site, you agree to
              these Terms of Service.
            </p>
            <p className="text-sm text-muted-foreground italic">
              We're a single-operator beta product. We reserve the right to update these
              terms as the service evolves. Material changes will be communicated via the
              site or email.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">2. Beta period</h2>
            <p>
              NearScene is in active beta. The service is provided <strong>as-is</strong>,
              may be unavailable at any time, and may change without notice. Features
              described as "coming soon" or "post-beta" are aspirational and not guaranteed.
              All features are currently free; pricing structures shown on the Pricing page
              are illustrative of plans we may offer in the future and are not active
              commitments.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">3. Eligibility and accounts</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must be at least 13 years old to use NearScene.</li>
              <li>You're responsible for keeping your account credentials secure.</li>
              <li>One account per person; please don't impersonate others.</li>
              <li>Account information you provide should be accurate.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">4. User content</h2>
            <p>
              You retain ownership of anything you post (forum posts, comments, ratings,
              event listings). By posting, you grant NearScene a non-exclusive license to
              display that content within the service.
            </p>
            <p className="mt-3"><strong>You may not post content that:</strong></p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Is illegal, harassing, threatening, defamatory, or hateful</li>
              <li>Infringes anyone else's intellectual property or privacy</li>
              <li>Is spam or commercial promotion outside the designated channels</li>
              <li>Misrepresents events, businesses, or your relationship to them</li>
              <li>Contains malware, phishing links, or attempts to compromise the service</li>
            </ul>
            <p className="mt-3">
              We reserve the right to remove any content that violates these terms and
              suspend accounts that repeatedly violate them. There is no formal appeals
              process during the beta — if you disagree with a moderation decision, contact
              us and we'll talk it through.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">5. Third-party data</h2>
            <p>
              NearScene aggregates publicly available data from third parties including
              Ticketmaster, SeatGeek, Yelp, OpenStreetMap, and Google News. We don't
              guarantee the accuracy, completeness, or availability of that data. Always
              verify event details (dates, prices, addresses) with the official source
              before making plans.
            </p>
            <p className="mt-3">
              Clicking out from NearScene to Ticketmaster, Yelp, or any other partner site
              subjects you to their terms and privacy policies — not ours.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">6. Business listings</h2>
            <p>
              Businesses listed on NearScene appear because they are publicly listed on
              Yelp, Ticketmaster, OpenStreetMap, or were submitted by users. A listing
              does not imply endorsement, partnership, or any business relationship between
              that business and NearScene. If you are a business owner and would like
              your listing removed or corrected, contact us.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">7. Payments</h2>
            <p>
              <strong>NearScene does not currently process payments during the beta.</strong>
              Pricing tiers shown on the Pricing page are not active. Any future paid
              features will be clearly opt-in and will require explicit acceptance of
              additional payment terms before any charges are made.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">8. Disclaimer of warranties</h2>
            <p className="uppercase text-sm">
              The service is provided "as is" and "as available" without warranties of any
              kind, whether express or implied, including warranties of merchantability,
              fitness for a particular purpose, accuracy, or non-infringement. Use of the
              service is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">9. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, NearScene and its operator shall not
              be liable for any indirect, incidental, special, consequential, or punitive
              damages, including loss of profits, data, use, or goodwill, arising out of
              your use of the service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">10. Termination</h2>
            <p>
              You can stop using NearScene any time and request account deletion via the
              email below. We may suspend or terminate accounts that violate these terms.
              The beta service may be discontinued at any time.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">11. Governing law</h2>
            <p>
              These terms are governed by the laws of the State of North Carolina, without
              regard to its conflict-of-law rules. Any dispute arising under these terms
              will be brought in the state or federal courts located in New Hanover County,
              North Carolina.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">12. Contact</h2>
            <p>
              Questions about these terms? Email <a href="mailto:steinackerr@gmail.com" className="text-primary underline">steinackerr@gmail.com</a> or use the "Send Feedback" button on any page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
