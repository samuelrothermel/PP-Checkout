document.addEventListener('DOMContentLoaded', function () {
  loadOrders();
});

async function loadOrders() {
  const loadingElement = document.getElementById('loading');
  const contentElement = document.getElementById('orders-content');
  const messageContainer = document.getElementById('message-container');

  try {
    loadingElement.style.display = 'block';
    contentElement.style.display = 'none';

    const response = await fetch('/api/orders');

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status}`);
    }

    const data = await response.json();
    const orders = data.orders || [];

    if (data.message) {
      showMessage(data.message, 'info');
    }

    displayOrders(orders);

    loadingElement.style.display = 'none';
    contentElement.style.display = 'block';
  } catch (error) {
    console.error('Error loading orders:', error);
    loadingElement.style.display = 'none';
    showMessage('Failed to load orders. Please try again.', 'error');
  }
}

function displayOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  tbody.innerHTML = '';

  if (orders.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <div style="margin-bottom: 15px;">
                        <strong>No Orders Available</strong>
                    </div>
                    <div style="font-size: 14px; line-height: 1.5; color: #888;">
                        PayPal's Orders API doesn't provide a "list all orders" endpoint.<br>
                        To implement order management, you need to:<br><br>
                        1. Store order IDs in your database when orders are created<br>
                        2. Use PayPal's GET /v2/checkout/orders/{order_id} to fetch individual order details<br>
                        3. Track order statuses and display them here<br><br>
                        <a href="index.html" style="color: #0070ba;">Create a new order</a> to see how individual orders work.
                    </div>
                </td>
            </tr>
        `;
    return;
  }

  orders.forEach(order => {
    const row = createOrderRow(order);
    tbody.appendChild(row);
  });
}

function createOrderRow(order) {
  const row = document.createElement('tr');

  // Extract order details
  const orderId = order.id;
  const createTime = new Date(order.create_time).toLocaleDateString();
  const amount = order.purchase_units?.[0]?.amount?.value || 'N/A';
  const currency = order.purchase_units?.[0]?.amount?.currency_code || 'USD';
  const status = order.status;

  // Determine payment source
  let paymentSource = 'Unknown';
  let paymentSourceIcon = '💳';

  if (order.payment_source) {
    if (order.payment_source.paypal) {
      paymentSource = 'PayPal';
      paymentSourceIcon = '🅿️';
    } else if (order.payment_source.card) {
      const brand = order.payment_source.card.brand || 'Card';
      const lastDigits = order.payment_source.card.last_digits || '';
      paymentSource = lastDigits ? `${brand} ****${lastDigits}` : brand;
      paymentSourceIcon = '💳';
    } else if (order.payment_source.venmo) {
      paymentSource = 'Venmo';
      paymentSourceIcon = '📱';
    } else if (order.payment_source.apple_pay) {
      paymentSource = 'Apple Pay';
      paymentSourceIcon = '🍎';
    } else if (order.payment_source.google_pay) {
      paymentSource = 'Google Pay';
      paymentSourceIcon = '🔍';
    }
  }

  row.innerHTML = `
        <td>
            <span style="font-family: monospace; font-size: 12px;">${orderId}</span>
        </td>
        <td>${createTime}</td>
        <td><strong>${currency} ${amount}</strong></td>
        <td>
            <div class="payment-source">
                <span class="payment-source-icon">${paymentSourceIcon}</span>
                <span>${paymentSource}</span>
            </div>
        </td>
        <td>
            <span class="status-badge status-${status.toLowerCase()}">
                ${status}
            </span>
        </td>
        <td>
            ${createActionButton(orderId, status)}
        </td>
    `;

  return row;
}

function createActionButton(orderId, status) {
  if (status === 'APPROVED') {
    return `
            <button class="capture-btn" onclick="captureOrder('${orderId}')">
                Capture Payment
            </button>
        `;
  } else if (status === 'COMPLETED') {
    return '<span style="color: #388e3c; font-size: 12px;">✓ Completed</span>';
  } else if (status === 'CREATED') {
    return '<span style="color: #666; font-size: 12px;">Pending</span>';
  } else {
    return `<span style="color: #666; font-size: 12px;">${status}</span>`;
  }
}

async function captureOrder(orderId) {
  const button = event.target;
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Capturing...';

    const response = await fetch(`/api/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Capture failed: ${response.status}`);
    }

    const captureData = await response.json();

    showMessage(`Order ${orderId} captured successfully!`, 'success');

    // Reload orders to show updated status
    setTimeout(() => {
      loadOrders();
    }, 1000);
  } catch (error) {
    console.error('Capture error:', error);
    showMessage(`Failed to capture order: ${error.message}`, 'error');

    button.disabled = false;
    button.textContent = originalText;
  }
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
