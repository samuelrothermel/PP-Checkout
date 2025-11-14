document.addEventListener('DOMContentLoaded', function () {
  loadVaultData();
});

// Helper functions for localStorage management
function getRecentCustomerIds() {
  try {
    return JSON.parse(localStorage.getItem('recentCustomerIds') || '[]');
  } catch (error) {
    console.error('Error reading customer IDs from localStorage:', error);
    return [];
  }
}

async function loadVaultData() {
  const loadingElement = document.getElementById('loading');
  const contentElement = document.getElementById('vault-content');
  const messageContainer = document.getElementById('message-container');

  try {
    loadingElement.style.display = 'block';
    contentElement.style.display = 'none';

    // Get recent customer IDs from localStorage
    const recentCustomerIds = getRecentCustomerIds();
    console.log('Recent customer IDs from localStorage:', recentCustomerIds);

    if (recentCustomerIds.length === 0) {
      displayVaultStats({
        totalCustomers: 0,
        totalPaymentMethods: 0,
        cardCount: 0,
        paypalCount: 0,
      });
      displayCustomers([]);
      loadingElement.style.display = 'none';
      contentElement.style.display = 'block';
      showMessage(
        'No vaulted customers found. Customers will appear here when you save payment methods during checkout.',
        'info'
      );
      return;
    }

    const response = await fetch('/api/vault/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerIds: recentCustomerIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch vault data: ${response.status}`);
    }

    const data = await response.json();
    const customers = data.customers || [];

    if (data.message) {
      showMessage(data.message, 'info');
    }

    // Calculate stats from the customer data
    let totalPaymentMethods = 0;
    let cardCount = 0;
    let paypalCount = 0;

    customers.forEach(customer => {
      if (customer.paymentTokens && customer.paymentTokens.length > 0) {
        totalPaymentMethods += customer.paymentTokens.length;
        customer.paymentTokens.forEach(token => {
          if (token.payment_source?.card) {
            cardCount++;
          } else if (token.payment_source?.paypal) {
            paypalCount++;
          }
        });
      }
    });

    const stats = {
      totalCustomers: customers.length,
      totalPaymentMethods,
      cardCount,
      paypalCount,
    };

    displayVaultStats(stats);
    displayCustomers(customers);

    loadingElement.style.display = 'none';
    contentElement.style.display = 'block';
  } catch (error) {
    console.error('Error loading vault data:', error);
    loadingElement.style.display = 'none';
    showMessage('Failed to load vault data. Please try again.', 'error');
  }
}

function displayVaultStats(stats) {
  const statsContainer = document.getElementById('vault-stats');
  statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats?.totalCustomers || 0}</div>
            <div class="stat-label">Total Customers</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats?.totalPaymentMethods || 0}</div>
            <div class="stat-label">Payment Methods</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats?.cardCount || 0}</div>
            <div class="stat-label">Cards</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats?.paypalCount || 0}</div>
            <div class="stat-label">PayPal Accounts</div>
        </div>
    `;
}

function displayCustomers(customers) {
  const container = document.getElementById('customers-container');
  container.innerHTML = '';

  if (customers.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <h3>No Vaulted Customers</h3>
                <p style="margin-bottom: 15px;">PayPal's Payment Method Tokens API requires tracking customer IDs in your database.</p>
                <div style="font-size: 14px; line-height: 1.5; color: #888; text-align: left; max-width: 600px; margin: 0 auto;">
                    Customer vault data will appear here when you save payment methods during checkout.<br>
                    Customer IDs are stored in your browser's local storage and payment methods are fetched from PayPal's Payment Method Tokens API.<br><br>
                </div>
                <a href="/checkout" class="nav-link" style="margin-top: 15px; display: inline-block;">Go to Checkout</a>
            </div>
        `;
    return;
  }

  customers.forEach(customer => {
    const customerCard = createCustomerCard(customer);
    container.appendChild(customerCard);
  });
}

function createCustomerCard(customer) {
  const card = document.createElement('div');
  card.className = 'customer-card';

  // Use the customerId from our response structure
  const customerId = customer.customerId;
  const paymentTokens = customer.paymentTokens || [];
  const customerDetails = customer.customerDetails || {};

  // Extract customer name from details if available
  let customerName = '';
  if (customerDetails.name) {
    if (typeof customerDetails.name === 'string') {
      customerName = customerDetails.name;
    } else if (
      customerDetails.name.given_name &&
      customerDetails.name.surname
    ) {
      customerName = `${customerDetails.name.given_name} ${customerDetails.name.surname}`;
    } else if (customerDetails.name.full_name) {
      customerName = customerDetails.name.full_name;
    }
  }

  // Format creation date from client timestamp or first payment token
  let createdDate = 'Unknown';
  if (customer.client_customer_timestamp) {
    createdDate = new Date(
      customer.client_customer_timestamp
    ).toLocaleDateString();
  } else if (paymentTokens.length > 0 && paymentTokens[0].create_time) {
    createdDate = new Date(paymentTokens[0].create_time).toLocaleDateString();
  }

  card.innerHTML = `
        <div class="customer-header">
            <div>
                <div class="customer-id">Customer ID: ${customerId}</div>
                ${
                  customerName
                    ? `<div class="customer-name">Name: ${customerName}</div>`
                    : ''
                }
                <div class="customer-date">Created: ${createdDate}</div>
            </div>
            <div>
                <span class="status-badge status-vaulted">Active</span>
            </div>
        </div>
        <div class="payment-methods">
            ${createPaymentMethodsHTML(paymentTokens)}
        </div>
    `;

  return card;
}

function createPaymentMethodsHTML(paymentMethods) {
  if (!paymentMethods || paymentMethods.length === 0) {
    return '<p style="color: #666; font-style: italic;">No payment methods found.</p>';
  }

  return paymentMethods
    .map(method => {
      const {
        icon,
        type,
        details,
        vaultId,
        vaultDate,
        status,
        description,
        usageType,
      } = parsePaymentMethod(method);

      return `
            <div class="payment-method">
                <div class="payment-info">
                    <div class="payment-details">
                        <div class="payment-type">${type}</div>
                        <div class="payment-meta">${details}</div>
                    </div>
                </div>
                <div class="vault-info">
                    <div class="vault-id">${vaultId}</div>
                    <div class="vault-description">${description}</div>
                    ${
                      usageType
                        ? `<div class="vault-usage-type">Usage: ${usageType}</div>`
                        : ''
                    }
                </div>
            </div>
        `;
    })
    .join('');
}

function parsePaymentMethod(method) {
  let icon = '💳';
  let type = 'Unknown';
  let details = 'N/A';
  let status = 'vaulted';
  let description = 'No description available';
  let usageType = '';

  const vaultId = method.id || 'N/A'; // Show full vault ID without truncation
  const vaultDate = method.create_time
    ? new Date(method.create_time).toLocaleDateString()
    : 'Unknown';

  // Log the method for debugging
  console.log('Parsing payment method:', JSON.stringify(method, null, 2));

  if (method.payment_source) {
    if (method.payment_source.card) {
      icon = '💳';
      const card = method.payment_source.card;
      type = `${card.brand || 'Card'}`;
      const lastDigits = card.last_digits || card.last_4_digits || '';
      const expiry = card.expiry || '';
      details = lastDigits ? `**** **** **** ${lastDigits}` : 'Card';
      if (expiry) {
        details += ` | Exp: ${expiry}`;
      }
      // Add cardholder name if available
      if (card.name) {
        details += ` | ${card.name}`;
      }

      // Set default values for cards
      description = 'Credit/Debit Card';
      usageType = 'payment';
    } else if (method.payment_source.paypal) {
      icon = '🅿️';
      type = 'PayPal';
      const paypal = method.payment_source.paypal;
      details = paypal.email_address || paypal.account_id || 'PayPal Account';

      // Add payer name if available
      if (paypal.name && paypal.name.given_name) {
        details += ` | ${paypal.name.given_name} ${
          paypal.name.surname || ''
        }`.trim();
      }

      // Extract PayPal-specific information
      description = paypal.description || 'PayPal Payment Method';
      usageType = paypal.usage_type
        ? paypal.usage_type.toLowerCase().replace('_', ' ')
        : '';

      // Add phone number if available
      if (paypal.phone && paypal.phone.phone_number) {
        const phone = paypal.phone.phone_number;
        if (phone.national_number) {
          details += ` | Phone: ${phone.national_number}`;
        }
      }
    } else if (method.payment_source.venmo) {
      icon = '📱';
      type = 'Venmo';
      const venmo = method.payment_source.venmo;
      details =
        venmo.email_address ||
        venmo.user_name ||
        venmo.username ||
        'Venmo Account';

      description = 'Venmo Payment Method';
      usageType = 'mobile payment';
    } else if (method.payment_source.apple_pay) {
      icon = '🍎';
      type = 'Apple Pay';
      const applePay = method.payment_source.apple_pay;
      details = 'Apple Pay';
      // Add card details if available within Apple Pay
      if (applePay.card) {
        const card = applePay.card;
        const lastDigits = card.last_digits || card.last_4_digits || '';
        if (lastDigits) {
          details += ` | **** ${lastDigits}`;
        }
        if (card.brand) {
          details += ` (${card.brand})`;
        }
      }

      description = 'Apple Pay Wallet';
      usageType = 'digital wallet';
    } else if (method.payment_source.google_pay) {
      icon = '🔍';
      type = 'Google Pay';
      const googlePay = method.payment_source.google_pay;
      details = 'Google Pay';
      // Add card details if available within Google Pay
      if (googlePay.card) {
        const card = googlePay.card;
        const lastDigits = card.last_digits || card.last_4_digits || '';
        if (lastDigits) {
          details += ` | **** ${lastDigits}`;
        }
        if (card.brand) {
          details += ` (${card.brand})`;
        }
      }

      description = 'Google Pay Wallet';
      usageType = 'digital wallet';
    }
  } else {
    // Fallback for unknown payment sources
    description = 'Payment Method';
    usageType = 'payment';
  }

  return {
    icon,
    type,
    details,
    vaultId,
    vaultDate,
    status,
    description,
    usageType,
  };
}

function showMessage(message, type = 'info') {
  const container = document.getElementById('message-container');
  const messageDiv = document.createElement('div');
  messageDiv.className = type;
  messageDiv.textContent = message;

  container.innerHTML = '';
  container.appendChild(messageDiv);

  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }
}
