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

    displayVaultStats(data.stats);
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

  // Format creation date
  const createdDate = customer.created_date
    ? new Date(customer.created_date).toLocaleDateString()
    : 'Unknown';

  card.innerHTML = `
        <div class="customer-header">
            <div>
                <div class="customer-id">Customer: ${customer.id}</div>
                <div class="customer-date">Created: ${createdDate}</div>
            </div>
            <div>
                <span class="status-badge status-vaulted">Active</span>
            </div>
        </div>
        <div class="payment-methods" id="methods-${customer.id}">
            ${
              customer.payment_methods
                ? createPaymentMethodsHTML(customer.payment_methods)
                : '<p style="color: #666; font-style: italic;">Loading payment methods...</p>'
            }
        </div>
    `;

  // Load payment methods if not already loaded
  if (!customer.payment_methods) {
    loadCustomerPaymentMethods(customer.id);
  }

  return card;
}

async function loadCustomerPaymentMethods(customerId) {
  try {
    const response = await fetch(
      `/api/vault/customers/${customerId}/payment-methods`
    );
    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById(`methods-${customerId}`);
      if (container) {
        container.innerHTML = createPaymentMethodsHTML(
          data.payment_methods || []
        );
      }
    }
  } catch (error) {
    console.error(
      'Error loading payment methods for customer:',
      customerId,
      error
    );
    const container = document.getElementById(`methods-${customerId}`);
    if (container) {
      container.innerHTML =
        '<p style="color: #d32f2f; font-style: italic;">Error loading payment methods</p>';
    }
  }
}

function createPaymentMethodsHTML(paymentMethods) {
  if (!paymentMethods || paymentMethods.length === 0) {
    return '<p style="color: #666; font-style: italic;">No payment methods found.</p>';
  }

  return paymentMethods
    .map(method => {
      const { icon, type, details, vaultId, vaultDate, status } =
        parsePaymentMethod(method);

      return `
            <div class="payment-method">
                <div class="payment-info">
                    <div class="payment-icon">${icon}</div>
                    <div class="payment-details">
                        <div class="payment-type">${type}</div>
                        <div class="payment-meta">${details}</div>
                    </div>
                </div>
                <div class="vault-info">
                    <div class="vault-id">${vaultId}</div>
                    <div class="vault-date">${vaultDate}</div>
                    <span class="status-badge status-${status}">${status}</span>
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

  const vaultId = method.id ? method.id.substring(0, 12) + '...' : 'N/A';
  const vaultDate = method.create_time
    ? new Date(method.create_time).toLocaleDateString()
    : 'Unknown';

  if (method.payment_source) {
    if (method.payment_source.card) {
      icon = '💳';
      const card = method.payment_source.card;
      type = `${card.brand || 'Card'}`;
      const lastDigits = card.last_digits || '';
      const expiry = card.expiry || '';
      details = lastDigits ? `**** **** **** ${lastDigits}` : 'Card';
      if (expiry) {
        details += ` | Exp: ${expiry}`;
      }
    } else if (method.payment_source.paypal) {
      icon = '🅿️';
      type = 'PayPal';
      const paypal = method.payment_source.paypal;
      details = paypal.email_address || 'PayPal Account';
    } else if (method.payment_source.venmo) {
      icon = '📱';
      type = 'Venmo';
      const venmo = method.payment_source.venmo;
      details = venmo.email_address || venmo.user_name || 'Venmo Account';
    } else if (method.payment_source.apple_pay) {
      icon = '🍎';
      type = 'Apple Pay';
      details = 'Apple Pay Payment Method';
    } else if (method.payment_source.google_pay) {
      icon = '🔍';
      type = 'Google Pay';
      details = 'Google Pay Payment Method';
    }
  }

  return { icon, type, details, vaultId, vaultDate, status };
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
