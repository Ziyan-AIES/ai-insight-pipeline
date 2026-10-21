# Investor newsletter subscription audit

Checked on 2026-10-21 (Asia/Shanghai). Subscriptions use the primary alias of the locally authorized Agent Mail account (`agently-cli +me`). Credentials, mailbox contents, confirmation URLs and subscription tokens are not stored in this repository.

The user authorized subscribing these firms, preferring AI, then technology. Atlas and BVP are one source. The spoken “H6Z” is interpreted as a16z from the supplied screenshot. Founders Fund and Foundation Capital are distinct; both were checked because the spoken request names the former and the screenshot names the latter.

## Results

| Institution | Official entry | Newsletter selection | Verified state |
| --- | --- | --- | --- |
| Sequoia Capital US/Europe | https://sequoiacap.com/stories | No current email signup found on the Stories page or homepage. Historical newsletter promotions were found, but do not establish a current signup. | Not subscribed; current entry not found. |
| Coatue | https://www.coatue.com/c/takes | C:\\Takes, technology/markets insights; email-only form has no topic selector. | Two submissions returned `Failed to fetch`; not confirmed. The Insights page itself lacks this form. |
| Bessemer Venture Partners / Atlas | https://www.bvp.com/atlas | Atlas, technology and venture research; no subscription topic selector. | Email confirmation completed; received “Welcome to Bessemer’s Atlas” from atlas@bvp.com. Confirmation redirects to a missing BVP page, but the subsequent welcome email proves success. |
| NFX | https://www.nfx.com/subscribe | Weekly founder/technology newsletter; no topic selector. | Page displayed “Thanks for subscribing!”; received “Welcome to NFX” from qed@nfx.com. |
| Founders Fund | https://foundersfund.com/anatomy-of-next/ | No public email signup found on the homepage or Anatomy of Next. | Not subscribed; entry not found. Do not substitute foundersfund.ca or unrelated similarly named publishers. |
| ICONIQ Venture & Growth | https://www.iconiq.com/growth/insights | Growth research/insights; no subscription topic selector. The AI Insights radio button filters articles, not the mailing list. | After reloading and submitting the visible footer Email Form, it displayed “Thank you! Your submission has been received!”; no welcome/confirmation email observed yet. Treat as submitted, pending delivery verification. |
| Menlo Ventures | https://menlovc.com/perspective/ | No email signup found on the inspected Perspective page. Article focus filters are not mailing preferences. | Not subscribed; RSS endpoint available as below. |
| a16z | https://a16z.com/newsletters/ | a16z News (technology) and AI Policy Brief. Jobs, crypto and speedrun were not selected. | Both official Substack embed forms returned a checkmark after subscription. No welcome/confirmation email observed yet. User explicitly approved accepting Substack terms for these subscriptions. |
| Lightspeed Venture Partners | https://newsletter.lsvp.com/subscribe | General Lightspeed technology/venture newsletter; no signup topic selector. | Submitted and redirected to newsletter homepage. No explicit success message or welcome email observed; pending verification. |
| Felicis | https://www.felicis.com/ | General technology/community news and insights; no topic selector. | Page displayed “Thanks for subscribing!”; no welcome/confirmation email observed yet. |
| Greylock | https://greylock.com/newsletter/ | Technology/firm newsletter; used email-only footer signup rather than inventing required first/last names on the longer form. | Footer displayed “Thanks — you're on the list.”; no welcome/confirmation email observed yet. |
| Foundation Capital (screenshot reference) | https://foundationcapital.com/ideas | The Foundation, monthly technology/venture newsletter; no signup topic selector. | Page displayed “You’re on the list!”; confirmation email from newsletters@foundationcapital.com was opened and its confirmation page explicitly stated “Your subscription to our list has been confirmed.” Subsequently received “Welcome to The Foundation, our new newsletter”. |

## RSS findings and limits

- Lightspeed's newsletter homepage explicitly links https://rss.beehiiv.com/feeds/oj8diHp4G5.xml . It is distinct from the main firm's Stories feed.
- https://menlovc.com/feed/ , https://greylock.com/feed/ and https://lsvp.com/feed/ returned `application/rss+xml` to the web fetcher. Full XML/item parsing was not completed because local fetches encountered TLS/network failures. These are discovered RSS endpoints, not fully validated ingest configurations.
- The tested a16z `/feed/` and NFX `/feed/` returned 404. This does not rule out other feeds. The requested a16z newsletters use Substack.
- No advertised RSS links were found in the retrieved HTML for Sequoia Stories, Coatue C:\\Takes, BVP Atlas, Felicis homepage or Foundation Capital homepage. This is not proof that no RSS exists.
- Network failures and inaccessible endpoints are recorded as unverified, never as proof of absence.

## Source registration follow-up (2026-10-21)

Live database inspection found existing a16z, Menlo and Sequoia RSS sources. The initial website-only audit above missed those existing entries. Their IDs and histories are preserved; Sequoia's homepage/domain are corrected from its Framer feed host to the original publisher.

`config/investor-sources.json` is the curated registration/setup ledger. `node scripts/sync-investor-sources.mjs` previews changes; `--apply` updates or adds rows without re-enabling paused existing sources. `--refresh` additionally checks fixed registry feeds and ingests relevant past-week items using the existing topic and URL rules. A private before-state receipt is written under ignored `logs/`.

RSS parsing succeeded for Sequoia (50 entries), Menlo (10), a16z News (20), a16z AI Policy (20), Greylock (50), Lightspeed Stories (10), and Lightspeed Newsletter (15). Network errors on some subsequent fetches are intermittent and are not evidence that the feeds do not exist. At setup, Sequoia's feed ended on August 19 and the Lightspeed newsletter feed on September 1, despite newer website material; these limits are explicitly shown in Sources.

Sources shows RSS, Website Agent or Agent email subscription, subscription verification state, setup check timestamp in Beijing time, and the separate last content/inbox check. Email sources are excluded from both manual and scheduled RSS refresh. Source setup checks do not update content ingestion timestamps or create a healthy-collection claim. ICONIQ's submission remains paused pending actual email verification.

The Information was added at the user's request. Its email preferences show Following for The Briefing, The Information AM, Applied AI, AI Agenda and AI Infrastructure. AI Agenda advertises a 14-day trial; subscriber-only access after the trial is not represented as a permanent free full-text subscription. No paid plan was purchased.

For compatibility with the existing database connector constraint, curated Agent email rows use the existing legacy RSS/empty-feed storage pattern, just like Website Agent sources. Both the frontend and ingestion exclusion read the same registry to resolve the actual method. This requires no database migration, new permissions or mailbox credentials in the application.

This registration does not install a weekly mailbox collection job. The UI explicitly states that automatic inbox checks are not scheduled. Inbox check timestamps remain empty until content is actually checked.

When implementing collection, retain the existing Signal Reference processing rules: AI/technology relevance, original publication date separate from email receipt date, canonical article URL deduplication across RSS/email, publisher attribution, and an explicit `email_newsletter` acquisition method. Macro analysis is primarily reference material and research direction; receiving a newsletter does not make it a breaking event or automatically promote it to Selected Sources. Confirmation/welcome messages, unsubscribe links and account notices are operational mail and must not enter research content. Paywalled excerpts remain excerpts and must not be described as full articles.

Private screenshots, mailbox evidence and operational deployment receipts are retained outside the repository or in ignored logs. Confirmation links and mailbox credentials are never included in the browser bundle.
