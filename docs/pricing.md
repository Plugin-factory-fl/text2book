# Text2Book pricing math

This document is the source of the numbers in `src/config/pricing.ts`.
Tiers are priced so **gross margin stays at least 50%** at the included
text allowance. Stripe price IDs in config are placeholders only.
Do not create live Stripe products from this file.

## Cost inputs (US, monthly)

| Item | Amount | Notes |
| --- | --- | --- |
| Twilio SMS (each way) | $0.0083 per segment | Programmable SMS US outbound/inbound list price |
| Carrier fees | $0.003 per segment | Typical US carrier surcharge blended |
| Phone number | $1.15 per month | Twilio local number |
| A2P 10DLC low volume campaign | $1.50 per month | Standard campaign is $10. Low volume fits these allowances |
| Stripe | 2.9% + $0.30 | Card subscription |
| OpenAI | $0.0025 per inbound | Conservative gpt-4.1-nano/mini blended cost for a short SMS turn |
| AI amortized per segment | $0.00125 | $0.0025 inbound spread across inbound plus outbound |

Brand registration is a one time A2P cost and is not in the monthly model.

## Blended variable cost

```
segment = 0.0083 + 0.003 + 0.00125 = $0.01255
fixed   = 1.15 + 1.50 = $2.65
```

## Margin rule

Gross margin = (price − total cost) / price ≥ 50%

```
total cost = Stripe fee + fixed + 0.01255 × segments
Stripe fee = 0.029 × price + 0.30

0.029P + 0.30 + 2.65 + 0.01255S ≤ 0.50P
0.01255S ≤ 0.471P − 2.95
S ≤ (0.471P − 2.95) / 0.01255
```

Round **down** to a clean allowance.

## Included segments

| Tier | Price | Max S before 50% | Allowance | Cost at cap | Margin at cap |
| --- | --- | --- | --- | --- | --- |
| Starter | $19.99 | 515 | **500** | $9.80 | **50.95%** |
| Growth | $29.99 | 890 | **850** | $14.49 | **51.69%** |
| Pro | $39.99 | 1265 | **1200** | $19.17 | **52.06%** |

Worked Starter example:

```
Stripe     = 0.029 × 19.99 + 0.30 = $0.88
Fixed      = $2.65
Variable   = 500 × 0.01255 = $6.28
Total cost = $9.80
Margin     = (19.99 − 9.80) / 19.99 = 50.95%
```

## Usage policy

- Meter **inbound + outbound SMS segments** per business per calendar month.
- Warn the owner (Chief chat + email log) at **80%** of the tier allowance.
- At **100%** require an upgrade to the next tier. At Pro, prompt to contact
  for overage instead of a silent cutoff.
- **Never drop an in-progress booking conversation.** If the client is mid
  booking, keep talking and keep notifying the owner.

## Placeholders

```
STRIPE_PRICE_ID_STARTER=price_text2book_starter_placeholder
STRIPE_PRICE_ID_GROWTH=price_text2book_growth_placeholder
STRIPE_PRICE_ID_PRO=price_text2book_pro_placeholder
```

These are config strings only. Create real Stripe prices later in the
Text2Book platform account. Never attach MegaMix products or webhooks.
