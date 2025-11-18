document.addEventListener('DOMContentLoaded', function () {
  loadOrders();
});

// Helper functions for localStorage management using StorageManager
function getRecentOrderIds() {
  try {
    // First try to get orders from StorageManager
    if (window.paypalStorageManager) {
      const orders = window.paypalStorageManager.getOrders();
      return orders.map(order => order.id);
    }

    // Fallback to legacy method for backward compatibility
    return JSON.parse(localStorage.getItem('recentOrderIds') || '[]');
  } catch (error) {
    console.error('Error reading order IDs from localStorage:', error);
    return [];
  }
}

function removeOrderFromLocalStorage(orderId) {
  try {
    // Use StorageManager if available
    if (window.paypalStorageManager) {
      const orders = window.paypalStorageManager.getOrders();
      const updatedOrders = orders.filter(order => order.id !== orderId);
      window.paypalStorageManager.setItem('orders', updatedOrders);
      console.log('Order removed from StorageManager:', orderId);
      return;
    }

    // Fallback to legacy method
    const recentOrderIds = getRecentOrderIds();
    const updatedOrderIds = recentOrderIds.filter(id => id !== orderId);
    localStorage.setItem('recentOrderIds', JSON.stringify(updatedOrderIds));
    console.log('Order removed from localStorage:', orderId);
    console.log('Updated order IDs:', updatedOrderIds);
  } catch (error) {
    console.error('Error removing order from localStorage:', error);
  }
}

function clearAllOrdersFromLocalStorage() {
  try {
    // Use StorageManager if available
    if (window.paypalStorageManager) {
      window.paypalStorageManager.setItem('orders', []);
      console.log('All orders cleared from StorageManager');
      return;
    }

    // Fallback to legacy method
    localStorage.removeItem('recentOrderIds');
    console.log('All orders cleared from localStorage');
  } catch (error) {
    console.error('Error clearing all orders from localStorage:', error);
  }
}

async function loadOrders() {
  const loadingElement = document.getElementById('loading');
  const contentElement = document.getElementById('orders-content');
  const messageContainer = document.getElementById('message-container');

  try {
    loadingElement.style.display = 'block';
    contentElement.style.display = 'none';

    // Get recent order IDs from localStorage
    const recentOrderIds = getRecentOrderIds();
    console.log('Recent order IDs from localStorage:', recentOrderIds);

    if (recentOrderIds.length === 0) {
      displayOrders([]);
      loadingElement.style.display = 'none';
      contentElement.style.display = 'block';
      showMessage(
        'No recent orders found. Orders will appear here after you place them on the checkout page.',
        'info'
      );
      return;
    }

    const response = await fetch('/api/orders/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderIds: recentOrderIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status}`);
    }

    const data = await response.json();
    const orders = data.orders || [];

    // Log server-side response like vault page
    console.log('Server-side orders response:', JSON.stringify(data, null, 2));

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
                        Orders placed on the checkout page will appear here automatically.<br>
                        Order IDs are stored in your browser's local storage and fetched from PayPal's Orders API.<br><br>
                        <a href="/checkout" style="color: #0070ba;">Go to Checkout</a> to place your first order.
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

  // Log individual order details for debugging like vault page
  console.log('Processing order:', JSON.stringify(order, null, 2));

  // Extract order details
  const orderId = order.id;
  const createTime = new Date(order.create_time).toLocaleDateString();
  const amount = order.purchase_units?.[0]?.amount?.value || 'N/A';
  const currency = order.purchase_units?.[0]?.amount?.currency_code || 'USD';
  const status = order.status;

  // Determine display status - show Authorized/Captured instead of Completed
  let displayStatus = status;
  if (status === 'COMPLETED') {
    // Check if this order has captures (payment has been captured)
    const hasCaptures =
      order.purchase_units?.[0]?.payments?.captures?.length > 0;

    if (hasCaptures) {
      displayStatus = 'CAPTURED';
    } else if (
      order.intent === 'AUTHORIZE' ||
      order.purchase_units?.[0]?.payments?.authorizations?.length > 0
    ) {
      // Check if authorizations are still pending (not captured)
      const authorizations =
        order.purchase_units?.[0]?.payments?.authorizations || [];
      const hasPendingAuth = authorizations.some(
        auth => auth.status === 'CREATED'
      );

      if (hasPendingAuth) {
        displayStatus = 'AUTHORIZED';
      } else {
        displayStatus = 'CAPTURED';
      }
    } else {
      displayStatus = 'CAPTURED';
    }
  }

  // Determine payment source without icons
  let paymentSource = 'Unknown';

  if (order.payment_source) {
    if (order.payment_source.paypal) {
      paymentSource = 'PayPal';
    } else if (order.payment_source.card) {
      const brand = order.payment_source.card.brand || 'Card';
      const lastDigits = order.payment_source.card.last_digits || '';
      paymentSource = lastDigits ? `${brand} ****${lastDigits}` : brand;
    } else if (order.payment_source.venmo) {
      paymentSource = 'Venmo';
    } else if (order.payment_source.apple_pay) {
      paymentSource = 'Apple Pay';
    } else if (order.payment_source.google_pay) {
      paymentSource = 'Google Pay';
    }
  }

  row.innerHTML = `
        <td>
            <span class="order-id">${orderId}</span>
        </td>
        <td class="order-date">${createTime}</td>
        <td class="order-amount">${currency} ${amount}</td>
        <td class="payment-source-text">
            ${paymentSource}
        </td>
        <td>
            <span class="status-badge status-${(
              displayStatus || 'unknown'
            ).toLowerCase()}">
                ${displayStatus || 'Unknown'}
            </span>
        </td>
        <td>
            ${createActionButton(orderId, displayStatus, status)}
        </td>
    `;

  return row;
}

function createActionButton(orderId, displayStatus, originalStatus) {
  let actionButtons = '';

  if (displayStatus === 'AUTHORIZED') {
    actionButtons = `
            <button class="capture-btn" onclick="captureOrder('${orderId}')">
                Capture Payment
            </button>
        `;
  } else if (displayStatus === 'CAPTURED') {
    actionButtons = `
            <button class="refund-btn" onclick="refundOrder('${orderId}')" disabled>
                Refund Payment
            </button>
        `;
  } else if (originalStatus === 'APPROVED') {
    actionButtons = `
            <button class="capture-btn" onclick="captureOrder('${orderId}')">
                Capture Payment
            </button>
        `;
  } else if (originalStatus === 'CREATED') {
    actionButtons = '<span class="action-status pending">Pending</span>';
  } else {
    actionButtons = `<span class="action-status">${displayStatus}</span>`;
  }

  // Add delete button for all orders
  actionButtons += `
    <button class="delete-btn" onclick="deleteOrder('${orderId}')" style="margin-left: 10px;" title="Delete Order">
        Delete
    </button>
  `;

  return actionButtons;
}

async function captureOrder(orderId) {
  const button = event.target;
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Capturing...';

    // Call the capture authorized payment endpoint
    const response = await fetch(`/api/orders/${orderId}/capture-authorized`, {
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

    // Log capture response like vault page
    console.log(
      'Capture authorized payment response:',
      JSON.stringify(captureData, null, 2)
    );

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

async function refundOrder(orderId) {
  // Placeholder for refund functionality
  showMessage('Refund functionality not yet implemented', 'info');
}

function deleteAllOrders() {
  const recentOrderIds = getRecentOrderIds();

  if (recentOrderIds.length === 0) {
    showMessage('No orders to delete', 'info');
    return;
  }

  if (
    !confirm(
      `Are you sure you want to delete ALL ${recentOrderIds.length} orders? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    clearAllOrdersFromLocalStorage();
    showMessage(
      `All ${recentOrderIds.length} orders deleted successfully!`,
      'success'
    );

    // Reload orders to show empty list
    setTimeout(() => {
      loadOrders();
    }, 500);
  } catch (error) {
    console.error('Delete all orders error:', error);
    showMessage(`Failed to delete all orders: ${error.message}`, 'error');
  }
}

function deleteOrder(orderId) {
  if (
    !confirm(
      `Are you sure you want to delete order ${orderId}? This action cannot be undone.`
    )
  ) {
    return;
  }

  const button = event.target;
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Deleting...';

    // Remove order from localStorage
    removeOrderFromLocalStorage(orderId);

    console.log(`Order ${orderId} removed from localStorage`);

    showMessage(`Order ${orderId} deleted successfully!`, 'success');

    // Reload orders to show updated list
    setTimeout(() => {
      loadOrders();
    }, 500);
  } catch (error) {
    console.error('Delete error:', error);
    showMessage(`Failed to delete order: ${error.message}`, 'error');

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
