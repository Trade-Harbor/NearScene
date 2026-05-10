import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import usePageTitle from '../hooks/usePageTitle';

// Template Terms of Service for LocalDrift's beta period.
// Covers user-generated content rules, liability disclaimer, and ToS for the
// beta period. Have a lawyer review before exiting beta / accepting payments.
export default function TermsPage() {
  usePageTitle('Terms of Service');
  const lastUpdated = 'May 9, 2026';

  return (
    <div className="min-h-screen bg-background" data-testid="terms-page">
      <div className="container mx-auto max-w-3xl px-4 md:px-6 py-12">
        <Button variant="ghost" size="sm" className="mb-6" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to LocalDrift
          </Link>
        </Button>

        <h1 className="font-heading text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">1. Welcome — and what this is</h2>
            <p>
              LocalDrift is a local-discovery web app currently in beta, focused on the
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
              LocalDrift is in active beta. The service is provided <strong>as-is</strong>,
              may be unavailable at any time, and may change without notice. Features
              described as "coming soon" or "post-beta" are aspirational and not guaranteed.
              All features are currently free. We do not offer paid plans during the beta;
              when we do, any paid features will be clearly opt-in and require explicit
              acceptance of separate payment terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">3. Eligibility and accounts</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must be at least 13 years old to use LocalDrift.</li>
              <li>You're responsible for keeping your account credentials secure.</li>
              <li>One account per person; please don't impersonate others.</li>
              <li>Account information you provide should be accurate.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">4. User content</h2>
            <p>
              You retain ownership of anything you post (forum posts, comments, ratings,
              event listings). By posting, you grant LocalDrift a non-exclusive license to
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
            <h2 className="font-heading text-2xl font-semibold mb-3">5. Community moderation and reporting</h2>
            <p>
              Any signed-in user can flag a post, comment, or event for review using the
              report button on the relevant content. We use those reports to keep the site
              welcoming. Submitting reports you know to be false, or attempting to game the
              report system, may result in account suspension.
            </p>
            <p className="mt-3">
              When multiple distinct users report the same piece of content, it may be
              automatically hidden pending review. Auto-hiding is reversible — content
              found to be acceptable on review will be restored.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">6. Third-party data</h2>
            <p>
              LocalDrift aggregates publicly available data from third parties including
              Ticketmaster, SeatGeek, Yelp, OpenStreetMap, and Google News. We don't
              guarantee the accuracy, completeness, or availability of that data. Always
              verify event details (dates, prices, addresses) with the official source
              before making plans.
            </p>
            <p className="mt-3">
              Clicking out from LocalDrift to Ticketmaster, Yelp, or any other partner site
              subjects you to their terms and privacy policies — not ours.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">7. Business listings</h2>
            <p>
              Businesses listed on LocalDrift appear because they are publicly listed on
              Yelp, Ticketmaster, OpenStreetMap, or were submitted by users. A listing
              does not imply endorsement, partnership, or any business relationship between
              that business and LocalDrift. If you are a business owner and would like
              your listing removed or corrected, contact us.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">8. Email communications</h2>
            <p>
              If you opt in to LocalDrift email updates (via the homepage or About-page
              signup form, or by creating an account that signs you up for product emails),
              you'll receive occasional emails such as our weekly "what's happening" digest.
              Every email includes a one-click unsubscribe link, and you can also unsubscribe
              by visiting <a href="/unsubscribe" className="text-primary underline">/unsubscribe</a>.
              Transactional emails directly tied to your account or actions (password resets,
              report acknowledgements) may still be sent regardless.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">9. Payments</h2>
            <p>
              <strong>LocalDrift does not currently process payments during the beta.</strong>
              Any future paid features will be clearly opt-in and will require explicit
              acceptance of additional payment terms before any charges are made.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">10. Copyright and DMCA</h2>
            <p>
              If you believe content on LocalDrift infringes your copyright, send a notice
              to <a href="mailto:hello@localdrift.app" className="text-primary underline">hello@localdrift.app</a>{' '}
              with the URL of the allegedly infringing content, a description of the work
              you believe was infringed, your contact information, and a good-faith statement
              that you are the rights holder or authorized to act on the rights holder's
              behalf. We'll review and remove infringing content as appropriate.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">11. Disclaimer of warranties</h2>
            <p className="uppercase text-sm">
              The service is provided "as is" and "as available" without warranties of any
              kind, whether express or implied, including warranties of merchantability,
              fitness for a particular purpose, accuracy, or non-infringement. Use of the
              service is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">12. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, LocalDrift and its operator shall not
              be liable for any indirect, incidental, special, consequential, or punitive
              damages, including loss of profits, data, use, or goodwill, arising out of
              your use of the service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">13. Termination</h2>
            <p>
              You can stop using LocalDrift any time and request account deletion via the
              email below. We may suspend or terminate accounts that violate these terms.
              The beta service may be discontinued at any time.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">14. Governing law</h2>
            <p>
              These terms are governed by the laws of the State of North Carolina, without
              regard to its conflict-of-law rules. Any dispute arising under these terms
              will be brought in the state or federal courts located in New Hanover County,
              North Carolina.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">15. Contact</h2>
            <p>
              Questions about these terms? Email <a href="mailto:hello@localdrift.app" className="text-primary underline">hello@localdrift.app</a> or use the "Send Feedback" button on any page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
