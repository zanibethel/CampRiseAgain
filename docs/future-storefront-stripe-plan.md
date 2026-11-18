# Future plan: Camp Rise Again storefront, donations, and Stripe fees

**Status:** Planning only — **not approved for implementation or launch**  
**Decision captured:** November 14, 2026  
**Site:** https://campriseagain.org  
**Purpose:** Preserve the agreed commercial model and a future integration plan for CRA's merchandise, digital content, and fundraising.

## Partner collaboration planning (ZOX)

A [ZOX affiliate and exclusive CampRiseAgain charity wristband proposal](zox-affiliate-charity-collaboration-plan-2026-11-18.md) was recorded November 18, 2026. It proposes ZOX-hosted checkout through approved referral links and a separately negotiated co-branded charity design. **Planning only:** no ZOX partnership, affiliate approval, public partner catalog, or live store launch is implied. Do not apply the current 5% CRA-processed retail fee automatically to externally paid affiliate or charity contributions.

## Cost comparison and possible future pricing review

A separate [storefront cost comparison and fee scenario reference](storefront-cost-comparison-2026-11-14.md) records the November 14, 2026 discussion of third-party storefronts and **$10,000–$20,000 in expected annual retail sales**. It compares **5%, 6%, 8%, and 10% all-inclusive fees** after illustrative Stripe card processing. **8% was suggested as a potential future proposal, not adopted.** The original **5% baseline** remains unchanged until explicitly approved. Re-check vendor prices and actual Connect fees at implementation time.

## Decisions to preserve

1. **Separate CRA Stripe account.** Camp Rise Again will have its own Stripe account and payout destination, rather than running sales and donations through the existing Cooperative account. Where Stripe allows, the accounts may be managed using the same owner's login, but their balances, transaction records, and payouts must remain separate.
2. **One storefront on the existing CRA website.** Use the existing Next.js app, Supabase database, Vercel deployment, Resend email system, and administrator dashboard. Do not introduce Shopify/WooCommerce as a prerequisite.
3. **Products:** physical merchandise (e.g., shirts, hoodies, hats) and digital content (e.g., downloadable resources, guides, workbooks).
4. **Donations:** offer one-time contributions and potentially recurring contributions. Keep donation accounting distinct from taxable/retail sales; do not claim contributions are tax-deductible without verifying CRA's eligibility.
5. **Operations/processing allocation: 5% total on eligible product sales, inclusive of Stripe card-processing fees.** This is **not** 5% plus Stripe processing fees charged to CRA. The 5% includes costs of card acceptance; any leftover amount is available for the site owner's hosting, email, support, maintenance, and updates. The selected baseline is **5%**, not the previously discussed 6% or 10%.
6. **CRA's agreed allocation: 95% of eligible product-sale amounts before CRA's own product production, fulfillment, shipping, refunds, and tax obligations.** Those costs are distinct from the payment-processing/operating allocation.
7. **Donations: 0% website operating commission** as the provisional rule. Donation payment-processing responsibility is a **separate open decision**; do not quietly deduct a 5% operating fee from donations or promise fee-free donation processing.
8. **No extra CRA processing surcharge.** Implementation must ensure CRA is not unexpectedly billed separate Stripe processing or Connect fees on top of the agreed 5%. If the chosen payment-flow configuration cannot accomplish this, do not launch with incorrect economics; redesign the payment flow or seek explicit revised approval.
9. **Supplier integrations:** prefer print-on-demand integration rather than holding shirt inventory. Evaluate Printful first, with a reusable supplier interface that could later integrate Printify, Gelato, or another provider.
10. **Only planning is authorized now.** Do not enable transactions, connect live credentials, change the existing GoFundMe buttons, place supplier orders, create financial accounts, or deploy a storefront from this plan alone.

## Operating-fee calculation (illustrative)

For each eligible merchandise/digital sale:

- Define the **fee base** provisionally as the paid product subtotal **after discounts and before sales tax and separately charged shipping**; exclude donations. Confirm this definition with CRA before implementation.
- **Total processing + operating allowance = fee base × 5%.**
- All Stripe card-processing costs attributable to those eligible product payments are borne **within** that 5% allowance, not charged to CRA in addition.
- **Net operating contribution = 5% allowance − actual Stripe processing fees − applicable Connect/payment costs**, which may be negative on small orders, international payments, refunds, or disputes.
- **CRA retains 95% of the fee base**, before merchandise supplier charges and fulfillment. Tax and shipping collection/disbursement must be modeled independently, rather than silently treated as operating revenue.
- If actual payment-processing/Connect charges exceed the 5% allowance, the platform owner bears the shortfall under the agreed model unless CRA explicitly approves an amended agreement; log and alert on the shortfall. Never silently reduce CRA's 95% allocation.

### Example: $40 merchandise subtotal

| Allocation | Amount |
|---|---:|
| Customer's product subtotal | $40.00 |
| CRA's 95% product-share before supplier/fulfillment expenses | $38.00 |
| Combined processing and operating allowance (5%) | $2.00 |
| Illustrative domestic Stripe card fee at 2.9% + $0.30 | $1.46 |
| Illustrative remaining operating contribution before any Connect/other charges | $0.54 |

The above is an illustration, **not** a quote of contracted Stripe pricing or a guarantee of settlement behavior. For reference, at 2.9% + $0.30 alone, a 5% allowance breaks even on processing around **$14.29 per order**; smaller orders would have negative operating contribution even before any Connect fees.

## Proposed payment architecture to evaluate (not finalized)

- **Stripe Checkout** for one-time purchases; use Stripe Billing/recurring payment features for optional recurring donations where appropriate.
- **Stripe Connect** between the operating/platform entity and the separate CRA Stripe account so an agreed application fee can be transferred to the operating entity. Determine an account/charge type that gives CRA the correct merchant-of-record relationship and ensures processing fees are paid from the **5% allowance**.
- Stripe's **direct charges** can support application fees, but **who Stripe bills for processing depends on Connect setup/account eligibility**. Do not assume a direct-charge application fee automatically protects CRA's 95% allocation.
- Compare direct charges with destination charges and any viable fee-reimbursement approach, including settlement, fraud, refund, dispute, liability, and Connect fee implications. Choose and test before launch.
- Verify signed Stripe webhooks server-side, idempotent payment/order recording, refund/chargeback reconciliation, fee-ledger transparency, and that client-supplied amounts cannot be trusted.
- Keep card details entirely within Stripe-hosted payment collection. Store only necessary order/payment references and permitted customer information in Supabase.
- Do not mingle CRA donations with merchandise in accounting. Product payment fees, donation processing, shipping, tax, and printer invoices need separately identifiable ledger entries.

Documentation: https://docs.stripe.com/connect/charges and https://docs.stripe.com/connect/interactive-platform-guide

## Storefront and admin features for a later build

- Public **Shop** with product collections, images, prices, variants (size/color), product detail pages, cart, and mobile-friendly checkout.
- Product management inside CRA **/admin**: create/edit/activate/deactivate merch and digital products; photos/assets; prices, discounts, optional inventory and supplier mapping.
- Supplier integrations screen: connect provider securely, import/link selected products, get cost/size/shipping estimates, send **paid and validated** fulfillment orders, track shipment status; use manual review or approval until automation is verified.
- Digital delivery: private file storage, expiring authorized download links after verified payment, safe resend/re-download workflow.
- Order history and status, tracking messages via Resend, refund workflow, audit log, and CRM contact association with sensible access controls and relevant consent.
- Admin financial reports: gross sales, discounts, taxes, shipping, refunds, Stripe processing, Connect charges, **5% total allowance**, true residual operating contribution, CRA's allocated 95%, supplier expenses, and donation funds — separately.
- Configurable commission-rate setting only with authorized admin change controls, an effective date, audit trail, and signed-off agreement. **Default 5% and do not alter without approval.**
- Leave current GoFundMe URL and Donate button behavior intact until a separately approved migration plan.

## Commercial/compliance decisions before launch

- Confirm CRA's legal organization, ownership/control of its Stripe account, payout bank, applicable nonprofit/charitable status and disclosures, and whether the operating business can legally and contractually receive the 5% fee.
- Use a written services/processing agreement describing the 5% **all-inclusive** allocation, calculation base, loss handling, refunds, fees, sales taxes, fulfillment responsibilities, termination, and transparency. Obtain appropriate CRA approval and conflict-of-interest review when applicable.
- Decide whether optional Stripe donations replace, supplement, or sit alongside GoFundMe, and who pays **donation** card fees. The 5% retail allowance should **not** be assumed to cover donations.
- Confirm merchant, sales-tax obligations (including digital goods), shipping/refund policies, supplier contractual terms, and what happens if costs exceed margins.
- Check current Stripe prices, product eligibility, Connect responsibilities, and account arrangements at implementation time rather than relying on historical estimates.

## Suggested future rollout (only when authorized)

1. Confirm business/legal/fee agreement and account ownership; create/onboard a separate CRA Stripe account safely.
2. Create admin-managed product catalog, customer storefront, test-mode Checkout, and webhooks; prove ledger math, reversals, and the no-extra-fee commitment.
3. Add digital fulfillment, supplier adapter (initially Printful), shipping and fulfillment support, and reporting.
4. Add one-time/recurring Stripe donations **after separate donation-fee approval**; keep existing fundraising path active until then.
5. Run end-to-end tests of small/large orders, multi-item orders, fees, Connect settlement, out-of-stock/supplier failures, refunds, fraud/disputes, donations, and admin access; seek explicit approval before production release.

**Reminder:** This file records an agreed *planning model*, not an active payment-processing configuration.
