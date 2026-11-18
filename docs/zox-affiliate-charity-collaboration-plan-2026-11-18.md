# ZOX × CampRiseAgain — affiliate and charity collaboration proposal

**Captured:** November 18, 2026  
**Status:** Planning only. No partnership agreed, application sent, code issued, storefront integration built, Stripe processing enabled, or campaign launched.  
**Owner of outreach:** An authorized CampRiseAgain representative, subject to internal approval.  
**Related:** [Future CampRiseAgain storefront and Stripe plan](future-storefront-stripe-plan.md) and [storefront cost comparisons](storefront-cost-comparison-2026-11-14.md).

## Intent and mission

Explore a mission-aligned collaboration with ZOX (https://zox.co), whose inspirational reminder wristbands are a potential fit for CampRiseAgain's **men's mental-health** mission.

Pursue **both tracks** in a coordinated proposal:

1. **Affiliate/referral track:** Curate approved ZOX products on a future "Partner Products" section of CampRiseAgain.org. Send customers to ZOX's own checkout through approved referral links or codes; ZOX remains responsible for product sale, payment processing, customer support, returns, and shipping as contractually defined. Any qualifying commissions support CampRiseAgain.
2. **Exclusive co-branded charity track:** Request a limited or ongoing "ZOX × CampRiseAgain" wristband with a resilience, connection, hope, or men's mental-health message. Negotiate a **defined contribution per completed, nonrefunded item**, paid to CampRiseAgain, and ideally ZOX-managed manufacturing and fulfillment with **no inventory purchase required** by the camp.

These are proposed approaches, **not approved contractual arrangements**. Do not use "official partner," ZOX brand assets, affiliate claims, or promised donation amounts publicly without permission and written terms.

## Outreach sequence — not sent

1. Have Tierra or another authorized camp representative approve the email and the nonprofit/organization description.
2. Inquire through ZOX's official custom-collaboration channel, https://zox.co/pages/custom, and inquire whether they welcome a combined affiliate + charitable campaign.
3. Separately ask about organizational participation in the ZOX advocate/affiliate program at https://zox.co/pages/advocate; https://ui.awin.com/merchant-profile/95335 may be an additional affiliate pathway to evaluate.
4. Request current, written details: organizational eligibility, code/link attribution, first-time vs. returning-customer eligibility, discounts, rate, payout threshold/timing, returns/cancellations, permitted marketing, logo/image license, reporting/export/API support, custom design approval, minimum order quantity, production/fulfillment costs, exclusive launch options, and charitable campaign disclosure requirements.
5. Obtain written terms and internal approval before activating any partner product links or making public fundraising claims.

### Draft outreach email — requires approval before sending

**To:** ZOX partnerships/custom-collaborations team (verify recipient; no email address assumed)  
**From:** An authorized CampRiseAgain representative, ideally info@campriseagain.org  
**Subject:** Partnership Opportunity — ZOX × CampRiseAgain

Hello ZOX Team,

I'm reaching out on behalf of CampRiseAgain, an organization dedicated to supporting men's mental health through connection, encouragement, and meaningful shared experiences.

I've personally purchased ZOX products, and I believe what you've created aligns well with our mission. Carrying a positive reminder each day connects with the impact we're working to make through CampRiseAgain.

We're planning a future merchandise and fundraising store at https://CampRiseAgain.org and would love to explore two related opportunities:

**Affiliate partnership:** We'd like to feature a curated selection of approved ZOX products on our website, with supporters purchasing directly through ZOX while qualifying referral commissions help fund the camp.

**Exclusive ZOX × CampRiseAgain collaboration:** We'd also love to explore a custom wristband built around men's mental health, resilience, hope, and connection. Ideally, an agreed contribution from each qualifying sale would support CampRiseAgain, with design and fulfillment responsibilities worked out together.

Could you let us know whether your team would be open to one or both ideas, and what the applicable terms, production requirements, fundraising arrangements, brand approvals, and fulfillment options might be?

Thank you for considering a collaboration that could benefit both organizations and the people we hope to reach.

Best regards,  
CampRiseAgain Team  
https://CampRiseAgain.org

## Commercial model to propose

| Stream | Proposed operating and accounting treatment |
|---|---|
| Standard ZOX products | Use ZOX-approved affiliate links/codes; recognize **actual commission statements and receipts**, not projected revenue from clicks. |
| Exclusive co-branded wristband | Opening *negotiation* ask: **$3 per completed, nonrefunded wristband** contributed to CampRiseAgain, subject to actual economics and written agreement. This is **not** a ZOX offer or agreed rate. |
| Exclusive production and fulfillment | Prefer ZOX manufactures, processes checkout, ships, and manages product support; confirm in writing, including returns and chargebacks. |
| Contributions and affiliate stacking | Explicitly ask if the affiliate commission can coexist with the charitable per-item contribution; **do not assume both apply**. |
| Partner revenue accounting | Keep affiliate earnings, charitable product contributions, and CampRiseAgain's own retail sales in separate ledger categories. |
| Existing CampRiseAgain store fee | Existing plan stays **5% all-inclusive of card processing for eligible CRA-processed product sales**, with 0% website operator commission on donations provisionally. **Do not automatically take 5% from ZOX-paid commissions or charity contributions.** Any fee change or fee on partnership income requires separate approval. |

The November 18 conversation discussed a ZOX advocate offer described as a **15% commission on qualifying first-time sales with an assigned code and possible first-purchase discount**. These are **research notes only**, not relied-upon terms: confirm the current agreement directly with ZOX before any site copy, accounting, or integration work. Do not assume repeat-purchase earnings, tracking without a promo code, or a combined shared cart. Partner affiliate terms may restrict online resale, co-branded advertising, assets, and cart integration.

## Future technical integration — approval required before building

Use the existing Next.js / Vercel app, Supabase admin/CRM database, and CampRiseAgain admin portal. Avoid a second storefront platform when external partner product links are sufficient.

**Public storefront:** A distinct "Partner Products" collection with approved product image, name, description, campaign disclosure, optional partner-provided promo code, and a clearly labeled external **"Shop at ZOX"** link. ZOX products do **not** enter CampRiseAgain's own Stripe cart. Clearly indicate checkout, fulfillment, and returns are handled by ZOX. Include a plainly visible affiliate/compensation disclosure near the links. Never imply that clicking a link has already funded the camp.

**Future /admin → Store → Partners screen** (authenticated, role-authorized, audited):

- Partner name and website; agreement status; campaign and effective dates.
- Product cards: approved images/assets with rights record, headline, description, categories/tags, external product URL, referral tracking URL, assigned code, publish/unpublish, and feature scheduling.
- Configuration: exact per-item contribution and affiliate terms **only after written verification**, disclosure copy, report source, payout period, approval status, and internal notes.
- Reporting: outbound referral clicks, campaign/source tags, partner-reported qualified purchases **only when data is actually supplied**, verified commissions, credited charitable contributions, payouts received, refunds/reversals, and outstanding reconciliation.

**Technical protections:** Validate partner destination domains and redirect URLs on the server; prevent arbitrary open redirects. Keep affiliate credentials server-side, use least-privilege admin authorization and change logs, apply data minimization to referral click events, avoid collecting ZOX customer payment information, and reconcile based on ZOX reports. Do not infer successful sales from outbound clicks; do not use an automated scrape of third-party checkout data. Prefer approved feeds/APIs if available, otherwise manual partner statements.

**Architecture idea (not a committed schema):**

- `store_partners`: partner, terms approval/reference, brand disclosure, external domain, status.
- `partner_products`: partner ID, public content, rights-approved image, outbound link, code, schedule, publication status.
- `partner_referral_events`: time, product, campaign, non-identifying/referrer-safe attribution; do not store unnecessary personal data.
- `partner_settlement_reports` and `partner_settlement_lines`: partner period, actual qualified sales/commissions/contributions/refunds, receipts and reconciliation.

Keep partner revenue separate from merchant-of-record sales, donations, and the existing 5% fee ledger.

## Phased delivery when specifically authorized

1. **Partner outreach and verification:** Obtain approval to contact; send approved proposal; collect and review the written affiliate/campaign terms and brand rights.
2. **Partner-link MVP:** Add externally linked cards, consented brand assets, disclosure, mobile testing and admin-managed draft/publish. Do not touch the existing Donate flow.
3. **Admin tracking and reconciliation:** Optional privacy-aware click metrics; import or record verified partner statements and payments; monthly contribution report.
4. **Exclusive design rollout:** Approve slogan/artwork/IP permissions, per-item economics, ZOX fulfillment and reporting, end date, and public giving language; add the campaign collection only upon agreement.
5. **Expansion:** Reuse this partner integration pattern for other mission-aligned suppliers without coupling it to Stripe product checkout.

## Open decisions and launch gates

- Confirm CampRiseAgain legal/charitable status, who may sign partnership agreements, applicable fundraising disclosures, and whether charitable contributions can be described as tax-deductible; do not make unsupported claims.
- Obtain ZOX approval to use products, images, marks, discounts, custom design, and any fundraising/donation language.
- Confirm whether the affiliate program accepts organizational applicants, code attribution requirements, first-vs-repeat purchase rules, and ability to place links on the CampRiseAgain site.
- Confirm the contribution trigger, paid amount, gross/net definition, refund policy, timing and payee; clarify whether partner proceeds and affiliate commission can stack.
- Confirm ZOX sells and fulfills directly; do not add ZOX goods to CRA Stripe checkout or stock without an express reseller/fulfillment agreement.
- Design and approve the exact co-branded slogan, artwork, pricing, campaign duration and any exclusivity before production.
- Confirm privacy/consent requirements for tracking and the availability of official partner reports or API data.
- Preserve the existing [5% CRA product-sales plan](future-storefront-stripe-plan.md) and GoFundMe donation URL. No site update or customer-facing launch is authorized by this planning document.

**On resumption:** Recheck ZOX's live program terms and contacts, obtain internal outreach approval, and use this file as the source of truth for the intended collaboration. Do not mistake this planning record for a signed ZOX partnership.
