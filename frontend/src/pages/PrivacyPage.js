import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

// Template Privacy Policy for NearScene's beta period.
// Generic "small US web app" coverage — collects email, location, forum posts,
// uses third-party APIs (Yelp, Ticketmaster, SeatGeek, OpenStreetMap, Google News).
// Have a lawyer review before scaling commercially.
export default function PrivacyPage() {
  const lastUpdated = 'May 4, 2026';

  return (
    <div className="min-h-screen bg-background" data-testid="privacy-page">
      <div className="container mx-auto max-w-3xl px-4 md:px-6 py-12">
        <Button variant="ghost" size="sm" className="mb-6" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to NearScene
          </Link>
        </Button>

        <h1 className="font-heading text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Overview</h2>
            <p>
              NearScene ("we", "our", "us") is a local-discovery web app currently in beta,
              focused on the Wilmington, NC area. This Privacy Policy explains what
              information we collect, how we use it, and your choices.
            </p>
            <p className="text-sm text-muted-foreground italic">
              We are a single-operator beta product. If you have questions, use the
              "Send Feedback" button on any page or email steinackerr@gmail.com.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Information we collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account information.</strong> When you create an account, we store
                your email, a hashed password, your display name, and (optionally) a phone
                number, business name, and ZIP code. Passwords are never stored in plaintext.
              </li>
              <li>
                <strong>Location.</strong> If you grant browser geolocation permission, we
                store your latitude and longitude in your browser's localStorage to filter
                events and venues by distance. We do not transmit your precise location to
                our servers unless you submit a post or event tied to a location.
              </li>
              <li>
                <strong>Content you post.</strong> Forum posts, comments, ratings, and any
                events or businesses you submit are stored on our servers and are visible to
                other users.
              </li>
              <li>
                <strong>Usage information.</strong> Standard server logs (IP address, browser
                user-agent, request paths, timestamps) are kept for security and debugging
                purposes for up to 30 days.
              </li>
              <li>
                <strong>Feedback you send.</strong> If you submit feedback through the in-app
                form, we store the message, optional name, and optional email so we can
                respond.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">How we use information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide the core service: showing nearby events, restaurants, attractions, food trucks, and community posts.</li>
              <li>To authenticate you and maintain your session.</li>
              <li>To respond to feedback and support requests.</li>
              <li>To improve the service (analyzing aggregate usage patterns).</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal information. We do not run
              third-party advertising networks during the beta. We do not share your email
              or any account details with marketing partners.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Third-party data sources</h2>
            <p>
              NearScene aggregates publicly available local data from the following sources.
              Visiting NearScene does not transmit your information to these providers; we
              fetch their data server-side on a daily schedule.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Ticketmaster Discovery API</strong> — concert and sports events</li>
              <li><strong>SeatGeek API</strong> — concert and sports events</li>
              <li><strong>Yelp Fusion API</strong> — restaurants, bars, food trucks</li>
              <li><strong>OpenStreetMap (Overpass API)</strong> — parks, beaches, museums, landmarks</li>
              <li><strong>Google News RSS</strong> — local news headlines</li>
            </ul>
            <p>
              Clicking links to those external sites takes you to their domains, where their
              own privacy policies apply.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Cookies and local storage</h2>
            <p>
              We use browser localStorage to remember your login session, your selected
              location, and beta-banner dismissal. We do not use third-party tracking
              cookies during the beta.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Data retention</h2>
            <p>
              Account data is retained as long as your account exists. Content you post
              remains visible until you delete it or your account. To delete your account
              and associated data, contact steinackerr@gmail.com — we'll remove your data
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Your choices</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can request a copy of your data at any time.</li>
              <li>You can request deletion of your account and data at any time.</li>
              <li>You can revoke browser location permission via your browser settings.</li>
              <li>You can edit or delete any post or comment you've made.</li>
            </ul>
            <p className="mt-3">
              California, Virginia, Colorado, and other state-law residents may have
              additional rights (e.g., the right to know, delete, opt-out of sale). Since
              we do not sell personal information, the opt-out is automatic. To exercise
              other rights, contact us.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Children</h2>
            <p>
              NearScene is not directed at children under 13. We do not knowingly collect
              information from children under 13. If you believe a child has created an
              account, contact us and we'll delete it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Security</h2>
            <p>
              We use industry-standard practices: passwords are hashed with bcrypt,
              connections use HTTPS, and the database is hosted on MongoDB Atlas. No
              system is perfectly secure, however, and we cannot guarantee absolute
              security — please use a unique password and notify us if you suspect
              unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Changes to this policy</h2>
            <p>
              We may update this Privacy Policy as the product evolves out of beta. Material
              changes will be posted at the top of this page with a new "last updated" date.
              If we ever change how we use existing data in a way that affects you, we will
              notify you via email.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold mb-3">Contact</h2>
            <p>
              Questions or requests? Email <a href="mailto:steinackerr@gmail.com" className="text-primary underline">steinackerr@gmail.com</a> or use the
              "Send Feedback" button on any page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
