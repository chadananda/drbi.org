export const prerender = false;

const PLOT_PRICE = 1500;

// Detect dev/prod environment using existing pattern
const isDev = process.env.NODE_ENV === 'development' ||
              import.meta.env?.DEV ||
              import.meta.env?.APP_ENV === 'dev';

const PAYPAL_API = isDev
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

const getCredentials = () => {
  if (isDev) {
    return {
      clientId: process.env.PAYPAL_CLIENT_ID_SANDBOX,
      secret: process.env.PAYPAL_SECRET_SANDBOX
    };
  }
  return {
    clientId: process.env.PAYPAL_CLIENT_ID,
    secret: process.env.PAYPAL_SECRET
  };
};

// Get PayPal access token
async function getAccessToken() {
  const { clientId, secret } = getCredentials();

  if (!clientId || !secret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal auth error:', error);
    throw new Error(`Failed to authenticate with PayPal: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create draft invoice
async function createInvoice(accessToken, formData) {
  const { fullName, email, phone, numPlots, plotsFor, notes } = formData;
  const total = numPlots * PLOT_PRICE;

  // Build invoice note with customer details
  const invoiceNote = [
    `Plot(s) intended for: ${plotsFor}`,
    notes ? `Special requests: ${notes}` : ''
  ].filter(Boolean).join('\n\n');

  // Calculate due date (30 days from now)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const invoiceDate = new Date().toISOString().split('T')[0];

  const invoicePayload = {
    detail: {
      invoice_date: invoiceDate,
      currency_code: 'USD',
      note: invoiceNote,
      terms_and_conditions: `Payment required to complete plot reservation. Plots are not held until payment is received.

FUNERAL SERVICES
For caskets, headstones, and burial arrangements, please contact:
J. Warren Funeral Home - (520) 374-2000
J. Warren is familiar with Baha'i burial practices and exclusively manages burials at Desert Rose.`,
      payment_term: {
        term_type: 'DUE_ON_DATE_SPECIFIED',
        due_date: dueDateStr
      }
    },
    invoicer: {
      name: {
        given_name: 'Desert Rose',
        surname: 'Baha\'i Institute'
      },
      // Note: email_address omitted - PayPal uses the account's default email
      phones: [{
        country_code: '1',
        national_number: '5204667961',
        phone_type: 'MOBILE'
      }],
      address: {
        address_line_1: '1950 W. William Sears Dr.',
        admin_area_2: 'Eloy',
        admin_area_1: 'AZ',
        postal_code: '85131',
        country_code: 'US'
      },
      website: 'https://drbi.org',
      logo_url: 'https://drbi.org/favicon.png'
    },
    primary_recipients: [{
      billing_info: {
        name: {
          given_name: fullName.split(' ')[0] || fullName,
          surname: fullName.split(' ').slice(1).join(' ') || ''
        },
        email_address: email,
        phones: [{
          country_code: '1',
          national_number: phone.replace(/\D/g, ''),
          phone_type: 'MOBILE'
        }]
      }
    }],
    items: [{
      name: 'Cemetery Plot - Desert Rose Memorial Gardens',
      description: `Cemetery plot reservation at Desert Rose Memorial Gardens in Eloy, Arizona.`,
      quantity: numPlots.toString(),
      unit_amount: {
        currency_code: 'USD',
        value: PLOT_PRICE.toFixed(2)
      },
      unit_of_measure: 'QUANTITY'
    }],
    configuration: {
      partial_payment: {
        allow_partial_payment: false
      },
      allow_tip: false,
      tax_calculated_after_discount: false,
      tax_inclusive: false
    }
  };

  const response = await fetch(`${PAYPAL_API}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(invoicePayload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal create invoice error:', error);
    throw new Error(`Failed to create invoice: ${error}`);
  }

  return await response.json();
}

// Send invoice
async function sendInvoice(accessToken, invoiceId) {
  const response = await fetch(`${PAYPAL_API}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      send_to_invoicer: true,
      send_to_recipient: true
      // Note: additional_recipients removed - would need valid PayPal-linked email
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal send invoice error:', error);
    throw new Error(`Failed to send invoice: ${error}`);
  }

  return true;
}

// Get invoice details (to get payment URL)
async function getInvoiceDetails(accessToken, invoiceId) {
  const response = await fetch(`${PAYPAL_API}/v2/invoicing/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal get invoice error:', error);
    throw new Error('Failed to get invoice details');
  }

  return await response.json();
}

export async function POST({ request }) {
  try {
    const formData = await request.json();

    // Validate required fields
    const required = ['fullName', 'email', 'phone', 'numPlots', 'plotsFor'];
    for (const field of required) {
      if (!formData[field]) {
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate number of plots
    const numPlots = parseInt(formData.numPlots);
    if (isNaN(numPlots) || numPlots < 1 || numPlots > 10) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid number of plots (must be 1-10)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Creating cemetery invoice for ${formData.fullName} (${formData.email}) - ${numPlots} plot(s)`);
    console.log(`Environment: ${isDev ? 'sandbox' : 'production'}`);

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Create the invoice
    const invoice = await createInvoice(accessToken, { ...formData, numPlots });
    const invoiceId = invoice.id;

    console.log(`Invoice created: ${invoiceId}`);

    // Send the invoice
    await sendInvoice(accessToken, invoiceId);

    console.log(`Invoice sent: ${invoiceId}`);

    // Get invoice details for payment URL
    const invoiceDetails = await getInvoiceDetails(accessToken, invoiceId);

    // Extract payment URL from HATEOAS links
    const paymentLink = invoiceDetails.detail?.metadata?.recipient_view_url ||
                       invoiceDetails.links?.find(l => l.rel === 'payer-view')?.href ||
                       `https://www.paypal.com/invoice/p/#${invoiceId}`;

    const total = numPlots * PLOT_PRICE;

    return new Response(JSON.stringify({
      success: true,
      invoiceId: invoiceId,
      invoiceNumber: invoiceDetails.detail?.invoice_number || invoiceId,
      paymentUrl: paymentLink,
      total: total
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cemetery invoice error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create invoice. Please try again or contact us directly.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
