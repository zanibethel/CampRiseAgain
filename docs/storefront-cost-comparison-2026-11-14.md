# CRA storefront cost comparison and operating-fee scenarios

**Captured:** November 14, 2026  
**Status:** Reference for future planning only — **no fee change or implementation approved**  
**Related original plan:** [Future storefront, Stripe, and supplier integrations](future-storefront-stripe-plan.md)  
**Annual retail-sales assumption confirmed by owner:** **$10,000–$20,000 per year**, **not per month**.

> **Critical distinction:** The original documented baseline is **5% all-inclusive** on merchandise and digital-product sales, with the Stripe processing cost borne **inside** that percentage. After discussing likely annual sales, **8% all-inclusive was recommended as a possible proposal**, with **6% a possible negotiated alternative**, and **10% an upper comparison point**. This discussion did **not** authorize a change to 8%, and the baseline plan remains 5% until an explicit decision and CRA approval. Donations have a provisional **0% website operating commission**, with donation-specific processing costs to be separately decided.

## Goal and value provided

CRA could operate its own branded merchandise and digital goods shop at campriseagain.org using the existing Next.js app, Supabase CRM/admin dashboard, Vercel, Resend, a separate CRA Stripe account, and optional print-on-demand fulfillment (Printful first to evaluate; Printify/Gelato later if useful).

The operating allocation would compensate the site operator for **processing fees plus** hosting, email, storefront upkeep, supplier integrations, support, and occasional improvements. It is **not** an extra percentage *on top* of card fees. CRA would receive the remaining retail revenue **before its supplier printing, fulfillment, shipping, taxes and other merchandise costs**. Evaluate legal entity, appropriate disclosures, fairness of a percentage-of-sales services arrangement, and CRA's approval.

## Assumptions for apples-to-apples illustrations

- Annual product sales: **$10,000 or $20,000**; **average purchase: $40** = 250 or 500 annual card transactions.
- Illustrative US domestic online card processing: **2.9% + $0.30 per payment**. Illustrative processing effective rate: **3.65%** at a $40 order; $365 on $10,000 / $730 on $20,000.
- Tables estimate operating contribution as **product sales × agreed total fee % − standard card processing**.
- **Not included** in operating contribution: Stripe Connect charges, refunds/chargebacks, international-card surcharges, optional software, allocated hosting/Resend/Supabase/Vercel expenses, tax on operator's income, or the operator's labor. Actual costs, account structure, and card mix can change results.
- Products/retail sales only. Exclude donations from the retail-sales fee calculation.

## Annual fee sensitivity: what remains for operating expenses

| Inclusive retail fee | Gross allowance at $10k/year | Less card fees at $10k | Operating amount remaining at $10k | Gross allowance at $20k/year | Less card fees at $20k | Operating amount remaining at $20k |
|---|---:|---:|---:|---:|---:|---:|
| **5%** (documented baseline) | $500 | $365 | **$135** | $1,000 | $730 | **$270** |
| **6%** (possible compromise) | $600 | $365 | **$235** | $1,200 | $730 | **$470** |
| **8%** (recommended proposal, not approved) | $800 | $365 | **$435** | $1,600 | $730 | **$870** |
| **10%** (comparison point) | $1,000 | $365 | **$635** | $2,000 | $730 | **$1,270** |

The amounts in the **remaining** columns are **not take-home profit**. They are funds *available* to pay other operating expenses, Connect charges, taxes, and maintenance time. They can be negative for small transactions.

### Prior $500/year maintenance estimate

At $40 average orders and the assumed processing schedule, the retail volume required to leave **about $500 after basic card processing alone** is:

- **5%:** ~$37,037 annual retail sales
- **6%:** ~$21,277 annual retail sales
- **8%:** ~$11,494 annual retail sales
- **10%:** ~$7,874 annual retail sales

These thresholds **increase** once Connect fees and other costs are included. They also vary with order size, pricing mix and refunds.

## Comparison with outside storefronts (as discussed on Nov 14, 2026)

**Snapshot, not a guaranteed price quote.** Plans, monthly billing, processor rates, feature limits and promotional offers may have changed or been approximated when discussed. Re-check vendor pricing and plans before future budgeting or customer-facing claims.

| Option | Recurring storefront cost discussed | Payment/store fees discussed | Key difference |
|---|---|---|---|
| **Custom CRA + Stripe** | $0 **additional third-party storefront subscription** (existing infrastructure still costs money) | **5% all-inclusive baseline**; 8% is only a proposal | Own branded store integrated with CRA CRM/admin; developer must maintain it; supplier costs additional |
| **Shopify Basic** | $29/month when billed annually, or $39/month month-to-month (historical discussion benchmark) | Illustrative domestic card rate 2.9% + $0.30 | Conventional full-featured store; separate subscription and product/supplier costs |
| **Big Cartel Platinum** | $15/month (historical benchmark) | Processor fees, assumed 2.9% + $0.30 for comparison | Independent storefront with simpler features |
| **Etsy** | No mandatory monthly storefront subscription | 6.5% marketplace transaction + US Etsy Payments approx. 3% + $0.25; $0.20 listing per unit/listing in illustration | Marketplace audience, fees, limits/terms; not a fully owned CRA site |
| **Fourthwall** | No mandatory monthly subscription (benchmark) | Discussed physical-product processing ~2.9% + $0.30 and additional digital-content platform fee ~5% | Turnkey creator store and fulfillment; limitations/actual pricing must be verified |
| **Printful Quick Stores** | Free basic Quick Stores offer discussed | Product printing/fulfillment costs; verify current seller margins/payouts | Fast merchandise trial, but separate hosted shop and limited control/custom-domain capability |
| **Square Free online** | No mandatory storefront subscription (benchmark) | Illustration assumes ~3.3% + $0.30 online rate; verify current terms | Hosted alternative, separate from CRA admin/CRM |

Useful vendor pages to re-check: https://www.shopify.com/pricing ; https://www.bigcartel.com/pricing ; https://www.etsy.com/legal/fees/ ; https://fourthwall.com ; https://www.printful.com ; https://squareup.com/us/en/online-store ; https://stripe.com/pricing .

### Earlier monthly $1,000-sales comparison

Illustration for **25 purchases × $40 = $1,000** in monthly product sales:

| Option | Previously calculated storefront + payment costs per month | Assumptions/limits |
|---|---:|---|
| Fourthwall physical merch | **$36.50** | Illustrative processor only; product production/fulfillment separate; verify exact Fourthwall settlement/fees |
| Square Free | **$40.50** | Illustrative 3.3% + $0.30; verify plan/rate |
| **CRA custom at 5% baseline** | **$50.00** | No extra storefront subscription, but site operating expenses remain |
| Big Cartel Platinum | **$51.50** | $15 plan + $36.50 in standard assumed card fees |
| Shopify Basic, monthly billed | **$75.50** | $39 subscription + $36.50 processing |
| Etsy | **$106.25** | 6.5% ($65) + processing 3% ($30) + $0.25×25 ($6.25) + $0.20×25 ($5) |

At 5% on $1,000, the operator's gross allowance is **$50**; illustrative card fees **$36.50**; **$13.50 remains before other costs**.

The above is **not** a fully equivalent product/features comparison. Print-on-demand supplier production, order processing, policies, shipping costs, marketplace exposure, domain choice, CRM control, refunds and tax responsibilities differ significantly.

### Earlier annual Shopify Basic example

Using **$29/month paid annually** and the same 2.9% + $0.30 assumptions:
- $10,000 annual sales: $348 subscription + $365 card costs = **$713/year**.
- $20,000 annual sales: $348 subscription + $730 card costs = **$1,078/year**.

Compared with the CRA proposal:
- 5% of sales = $500 / $1,000 total (baseline).
- 8% of sales = $800 / $1,600 total (proposal, not accepted).

The CRA fee would include a services/operating component, not merely a store subscription; Shopify's amounts do **not** include professional custom development or CRA's ongoing support.

## Recommendation discussed; not a final decision

At **$10k–$20k per year**, **8% inclusive of payment processing** was suggested as a defensible **opening proposal** for a managed custom store, supplier integrations, and technical service. **6%** was suggested as a possible compromise and **5%** as the original leaner baseline; 10% is shown as an upper comparison, not a recommendation.

For comparison of the split **before CRA's product costs**:
- At **5%**, CRA share = 95% and operator's 5% pays Stripe processing first.
- At **6%**, CRA share = 94%, processing paid within 6%.
- At **8%**, CRA share = 92%, processing paid within 8%.
- At **10%**, CRA share = 90%, processing paid within 10%.

Annual rate review as sales grow was discussed; an option to reduce to **6% on future sales after a $20k/year threshold** was raised but **not approved**. Any fee change must be explicitly agreed in writing and appropriately authorized by CRA. A fixed base maintenance charge, cap, minimum, or tiered pricing can be compared later as alternatives; do not silently impose one.

## Technical and legal guardrails to retain

1. Keep **a separate Stripe account and payout bank for CRA** and the operator's own platform identity. Verify who Stripe actually charges fees under direct vs. destination charges and any connected-account pricing. Do not assume fee allocation automatically works just by setting an application fee.
2. **No Stripe surcharge on top** of the agreed inclusive percentage to CRA. If processing + Connect exceeds the operator's allowance, the operator bears the shortfall unless there is fresh written agreement otherwise.
3. **Donations:** the operator's proposed commission is **0%**. Whether CRA or another party covers Stripe's **donation processing** remains unresolved; do not assume donations are free to process.
4. Distinguish donated funds, retail revenue, sales tax, shipping receipts, supplier invoices, refunds and operator platform fees on the ledger.
5. Before implementation, verify CRA's tax/charity status, merchant-of-record relationship, nonprofit/private-benefit and conflict-of-interest issues, Stripe eligibility, pricing terms, actual supplier margins and approval from CRA decision-makers.
6. **Planning only.** Don't activate a store, edit current donation URLs, create live payment accounts, or change the selected 5% baseline without a fresh instruction.

## Quick retrieval reminder

When asked about **CRA storefront comparisons**, **pricing**, or **whether 5%, 6%, 8% or 10% is fair**, start with this file and [the original future storefront plan](future-storefront-stripe-plan.md). State the annual retail-sales assumption ($10k–$20k), processing-included rule, original 5% baseline vs. suggested 8%, and re-check current third-party prices before advising on a live decision.
