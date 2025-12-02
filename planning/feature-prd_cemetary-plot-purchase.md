# Cemetery Plot Purchase Feature - PRD

## Overview
Automate the cemetery plot purchase request and payment process by replacing the manual email-based workflow with an integrated form submission and PayPal invoicing system.

## Problem Statement
**Current Process:**
- Customers email plot purchase requests
- Staff manually creates PayPal invoices
- Emails sometimes get missed
- No centralized tracking of requests
- Manual, time-consuming process

**Pain Points:**
- Missed email requests lead to lost sales
- Inconsistent follow-up on unpaid invoices
- No easy way to view all pending/completed purchases
- Cumbersome manual invoice creation

## Goals
1. Automate invoice creation from form submissions
2. Provide immediate payment option for ready customers
3. Maintain paper trail via PayPal invoicing system
4. Centralize request tracking in admin dashboard
5. Reduce manual work and human error

## Solution Architecture

### User Flow
1. Customer visits cemetery plot purchase page
2. Fills out request form with contact info and plot details
3. Submits form → triggers API route
4. System creates PayPal invoice automatically
5. Customer sees confirmation page with two options:
   - **Pay Now** - redirect to PayPal checkout
   - **Pay Later** - invoice emailed with payment link
6. PayPal sends automatic reminders for unpaid invoices
7. Staff views all requests in admin dashboard

### Technical Components

#### 1. Request Form
**Location:** `/cemetery/purchase` or similar

**Fields to collect:**
- Full Name (required)
- Email Address (required)
- Phone Number (required)
- Number of Plots (required, dropdown or number input)
- Plot Location Preference (optional, textarea)
- Special Requests/Notes (optional, textarea)
- **Memorial Gardens Donation Section:**
  - "Support Memorial Gardens Renovation" checkbox
  - Donation amount (custom input or preset amounts: $25, $50, $100, $250, Other)
  - Make this recurring? (checkbox)
  - Recurring frequency (monthly/quarterly/yearly dropdown, shown if recurring checked)
  - Information about the renovation project (visitor center, parking, paths, trees)

**Validation:**
- Email format validation
- Phone format validation
- Minimum 1 plot required

#### 2. API Route
**Endpoint:** `/api/create-cemetery-invoice`

**Responsibilities:**
- Authenticate with PayPal API
- Create invoice with customer details for plot purchase
- If donation selected, add donation line item to invoice
- If recurring donation selected, create separate PayPal subscription
- Set invoice due date (recommended: 30-60 days)
- Configure automatic reminders
- Add line items for plot(s) with pricing
- Return invoice ID, payment URL, and subscription ID (if applicable)

**Error Handling:**
- PayPal API failures
- Network timeouts
- Duplicate submission detection
- Validation errors

#### 3. Confirmation Page
**Display:**
- Success message
- Invoice number/reference
- Two clear CTAs:
  - Primary: "Pay Now" button (redirects to PayPal)
  - Secondary: "Pay Later" explanation (check email for invoice)
- Contact information if they have questions

#### 4. Admin Dashboard
**Location:** `/admin/cemetery-plots` (password protected)

**Features:**
- List all invoices from PayPal API
- Filter by status: All, Paid, Unpaid, Overdue
- Search by customer name or email
- Sort by date, amount, status
- View customer details and special requests
- Link to PayPal invoice details
- Export to CSV for record-keeping
- **Donation tracking:**
  - Separate tab/section for recurring donations
  - List active subscriptions with status
  - Total donation amounts (one-time + recurring)
  - Ability to cancel/modify subscriptions if needed

**Data displayed per request:**
- Date submitted
- Customer name & contact info
- Number of plots
- Plot amount
- Donation amount (if any)
- Recurring donation status (if applicable)
- Total amount
- Payment status
- Invoice number
- Subscription ID (if recurring)
- Special requests/notes

## Technical Requirements

### PayPal Integration
**API:** PayPal Invoicing API v2
- REST API documentation: https://developer.paypal.com/docs/api/invoicing/v2/

**Credentials needed:**
- PayPal Client ID
- PayPal Secret
- Mode flag (sandbox/production)

**Key API Calls:**
1. `POST /v2/invoicing/invoices` - Create invoice (plot + one-time donation)
2. `POST /v2/invoicing/invoices/{invoice_id}/send` - Send invoice email
3. `POST /v1/billing/subscriptions` - Create recurring donation subscription
4. `GET /v2/invoicing/invoices` - List invoices for admin
5. `GET /v2/invoicing/invoices/{invoice_id}` - Get invoice details
6. `GET /v1/billing/subscriptions` - List subscriptions for admin

### Vercel Configuration
**Environment Variables:**
```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_SECRET=your_secret
PAYPAL_MODE=sandbox (or live)
ADMIN_PASSWORD=secure_password_hash
CEMETERY_PLOT_PRICE=price_per_plot
```

**API Routes:** Astro endpoint in `src/pages/api/`

**Deployment:** Standard Vercel deployment with environment variables configured in dashboard

### Data Flow
```
Customer Form
    ↓
Astro API Route (server-side)
    ↓
PayPal Authentication
    ↓
Create Invoice (plot + one-time donation if selected)
    ↓
Create Subscription (if recurring donation selected)
    ↓
Return to Customer (Pay Now or Pay Later)
    ↓
Admin Dashboard (queries PayPal API for status)
```

## Donation Implementation Details

### One-Time Donation
- Added as line item to the plot purchase invoice
- Single payment covers both plot and donation
- Shows as separate line item on invoice for tax purposes
- Customer receives single invoice for everything

### Recurring Donation
- **Separate from plot purchase** - uses PayPal Subscriptions API
- Customer must approve subscription separately (PayPal requirement)
- Three frequency options: Monthly, Quarterly, Yearly
- Automatically charges customer on schedule
- Customer can cancel anytime via PayPal
- Organization receives email notifications for each payment

### PayPal Subscription Setup
**Create Subscription Plan (one-time setup):**
1. Create "Memorial Gardens Renovation Fund" billing plan
2. Configure for variable amounts (customer sets donation amount)
3. Set up payment failure handling
4. Configure automatic receipts

**Per-Customer Subscription:**
- Links to customer's email
- Uses the amount they specified
- Starts immediately or on first payment
- Sends receipts automatically

### Donation UI/UX
**Form Presentation:**
```
┌─────────────────────────────────────────┐
│ Plot Purchase: $XXX x [N] plots         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🌳 Support Memorial Gardens Renovation  │
│                                          │
│ Help us build a visitor center, parking │
│ lot, decorative paths and trees over    │
│ the next decade.                         │
│                                          │
│ ☐ Yes, I'd like to donate               │
│                                          │
│ Amount: ( ) $25 ( ) $50 ( ) $100        │
│         ( ) $250 ( ) Other: $____       │
│                                          │
│ ☐ Make this a recurring donation        │
│   Frequency: [Monthly ▼]                │
└─────────────────────────────────────────┘
```

**Confirmation Page Updates:**
- Shows plot purchase amount
- Shows donation amount (one-time or recurring)
- If recurring: explains they'll approve subscription at PayPal
- Separate "thank you" message for donation

### Tax Considerations
**Important:**
- Donations may be tax-deductible (consult tax advisor)
- Need to clarify tax-exempt status of organization
- May need to provide donation receipts separate from plot invoices
- PayPal can generate separate receipts for donation portions

### Admin Considerations
- Track total donations received (one-time + recurring)
- Monitor recurring donation retention rate
- Send thank-you notes to major donors
- Annual donor reports for tax purposes
- Ability to reach out if recurring payment fails

## Configuration Details

### Invoice Settings
- **Due Date:** 30 days from creation (configurable)
- **Reminder Schedule:** 7 days, 14 days, 30 days (PayPal default)
- **Invoice Note:** "Cemetery plot reservation - Payment required to complete reservation. Plots are not held until payment is received."
- **Terms & Conditions:** Link to organization's cemetery policies

### Pricing Structure
**To be configured:**
- Price per plot
- Any bulk discounts
- Processing fees (if applicable)
- Tax handling (if applicable)

### Payment Methods
PayPal invoice supports:
- PayPal balance
- Credit/debit cards
- Bank account (via PayPal)

## Security Considerations

1. **Admin Access:** Password protection or auth system for dashboard
2. **API Keys:** Stored as environment variables, never in code
3. **Rate Limiting:** Prevent form spam/abuse
4. **Input Validation:** Sanitize all form inputs
5. **HTTPS:** Ensure all pages use SSL (Vercel default)

## Success Metrics
- **Efficiency:** Time saved on manual invoice creation
- **Conversion:** % of form submissions that result in payment
- **Response Time:** How quickly invoices are created vs. old email method
- **Payment Speed:** Average time from submission to payment
- **Error Rate:** Failed invoice creations or API errors
- **Donation Metrics:**
  - % of plot purchasers who also donate
  - Average donation amount
  - Recurring vs. one-time donation ratio
  - Recurring donation retention rate (% still active after 6/12 months)
  - Total funds raised for renovation project

## Future Enhancements (Out of Scope for V1)
- Plot availability map/visual selector
- Automated plot reservation system tied to payment
- Email confirmation to staff when new request comes in
- SMS notifications for customers
- Multiple payment plan options
- Integration with cemetery management software
- Automated thank you email after payment
- Digital receipt/deed generation
- **Donation enhancements:**
  - Public donor wall/recognition page on website
  - Donation progress tracker (visual thermometer showing renovation funding)
  - Donor levels/tiers (Bronze, Silver, Gold contributor badges)
  - Memorial brick/plaque program tied to donations
  - Donation impact stories/newsletter
  - Ability to donate in memory of someone
  - Matching gift program integration

## Open Questions
1. What is the exact price per plot?
2. Are there different plot types or pricing tiers?
3. Should plots be "held" for the 30-day invoice period?
4. What happens if invoice goes unpaid after due date?
5. Who should receive admin notifications for new requests?
6. Is there a maximum number of plots per purchase?
7. Any legal disclaimers needed on the form?
8. Should we collect additional info (e.g., intended use, deceased name)?
9. **Donation questions:**
   - Is the organization 501(c)(3) tax-exempt?
   - What are suggested donation amounts?
   - Should we have a minimum donation amount?
   - What should recurring donation default to (monthly/quarterly/yearly)?
   - Should we show renovation project progress/goal on form?
   - Do donors need to be acknowledged publicly?
   - Should we send separate tax receipts for donations?
   - What happens if a recurring donation payment fails?

## Timeline Estimate
- **Setup & Configuration:** 3-5 hours (PayPal account, API credentials, subscription plan setup)
- **Form Development:** 4-6 hours (form UI, validation, donation section)
- **API Integration:** 6-8 hours (PayPal API, subscription API, error handling)
- **Admin Dashboard:** 5-7 hours (list view, filtering, auth, donation tracking)
- **Testing:** 3-5 hours (sandbox testing, edge cases, subscription flow)
- **Documentation:** 1-2 hours (setup guide, admin guide)

**Total:** ~22-33 hours (3-4 days of focused work)

## Resources
- [PayPal Invoicing API Docs](https://developer.paypal.com/docs/api/invoicing/v2/)
- [PayPal Subscriptions API Docs](https://developer.paypal.com/docs/api/subscriptions/v1/)
- [Astro API Routes](https://docs.astro.build/en/core-concepts/endpoints/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## Implementation Checklist
- [ ] Create PayPal Business account (if not exists)
- [ ] Set up PayPal Developer app and get credentials
- [ ] Create Memorial Gardens donation subscription plan in PayPal
- [ ] Add environment variables to Vercel
- [ ] Create purchase request form page with donation section
- [ ] Build API route for invoice creation
- [ ] Build API route for subscription creation
- [ ] Create confirmation page with pay now/later options
- [ ] Build admin dashboard with invoice listing
- [ ] Add donation tracking section to admin dashboard
- [ ] Implement admin authentication
- [ ] Test in PayPal sandbox environment (invoice + subscription)
- [ ] Test recurring payment flow
- [ ] Document admin processes for managing donations
- [ ] Test edge cases (API failures, duplicate submissions, failed payments)
- [ ] Switch to production PayPal credentials
- [ ] Deploy to production
- [ ] Monitor first few submissions closely
- [ ] Verify tax receipt handling with accountant/lawyer