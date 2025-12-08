// User information storage
let currentUser = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializeLoginButton();
});

// Check OAuth Configuration
async function checkOAuthConfig() {
  try {
    showLoading('Checking configuration...');

    const response = await fetch('/api/payouts/oauth/config');
    const config = await response.json();

    const configSection = document.getElementById('config-section');
    const configDetails = document.getElementById('config-details');

    configDetails.innerHTML = `
      <div class="config-info">
        <h3>Current Configuration</h3>
        <div class="config-item">
          <strong>Client ID:</strong> <code>${config.clientId}</code>
        </div>
        <div class="config-item">
          <strong>Redirect URI:</strong> <code>${config.redirectUri}</code>
        </div>
        <div class="config-item">
          <strong>Required Scopes:</strong>
          <ul>
            ${config.requiredScopes
              .map(scope => `<li><code>${scope}</code></li>`)
              .join('')}
          </ul>
        </div>
        <div class="alert alert-info">
          <strong>⚠️ Important:</strong> ${config.instructions}
        </div>
        <div class="alert alert-warning">
          <strong>Setup Checklist:</strong>
          <ol>
            <li>Go to <a href="https://developer.paypal.com/dashboard" target="_blank">PayPal Developer Dashboard</a></li>
            <li>Select your app</li>
            <li>Enable "Log In with PayPal" under Features</li>
            <li>Click "Advanced options" and add this exact Return URL: <code>${
              config.redirectUri
            }</code></li>
            <li>Enable all the scopes listed above</li>
            <li>Save and wait a few minutes for changes to take effect</li>
          </ol>
        </div>
      </div>
    `;

    configSection.style.display = 'block';
    configSection.scrollIntoView({ behavior: 'smooth' });
    hideLoading();
  } catch (error) {
    console.error('Error checking config:', error);
    alert('Error checking configuration: ' + error.message);
    hideLoading();
  }
}

// Initialize PayPal Login Button
function initializeLoginButton() {
  if (!window.paypal) {
    console.error('PayPal SDK not loaded');
    return;
  }

  // Create a custom login button since PayPal deprecated the identity component
  const loginButton = document.getElementById('paypal-login-button');

  const button = document.createElement('button');
  button.className = 'btn-primary paypal-login';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
      <path fill="currentColor" d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .76-.653h8.53c1.66 0 2.96.44 3.76 1.27.78.8 1.18 1.93 1.18 3.36 0 2.59-1.35 4.38-3.37 5.01-.56.17-1.14.27-1.76.3h-3.84l-1.1 6.07a.64.64 0 0 1-.63.53zm10.55-11.66c-.38.21-.8.37-1.25.49a8.45 8.45 0 0 1-2.54.38h-4.69l-1.33 7.32h4.28l.9-4.94h2.5c3.26 0 5.45-1.58 5.45-4.83 0-1.26-.44-2.25-1.28-2.93a5.43 5.43 0 0 0-3.34-.97h-6.47L8.14 20.44h4.61l1.33-7.32h3.12c2.77 0 4.64-1.34 4.64-4.08 0-1.07-.38-1.92-1.09-2.49z"/>
    </svg>
    Login with PayPal
  `;

  button.onclick = () => {
    initiatePayPalLogin();
  };

  loginButton.appendChild(button);
}

// Initiate PayPal OAuth Login
function initiatePayPalLogin() {
  const clientId = window.clientId;
  const redirectUri = encodeURIComponent(
    window.location.origin + '/api/payouts/oauth/callback'
  );

  // Define the scopes we want to request
  const scopes = encodeURIComponent(
    'openid profile email https://uri.paypal.com/services/paypalattributes'
  );

  // Construct the OAuth URL - use /connect/ endpoint for Identity API
  const authUrl = `https://www.sandbox.paypal.com/connect/?flowEntry=static&client_id=${clientId}&response_type=code&scope=${scopes}&redirect_uri=${redirectUri}`;

  console.log('OAuth URL:', authUrl);
  console.log('Client ID:', clientId);
  console.log('Redirect URI:', decodeURIComponent(redirectUri));

  // Open OAuth in a popup
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    authUrl,
    'PayPal Login',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  // Listen for the callback
  window.addEventListener('message', handleOAuthCallback, false);
}

// Handle OAuth callback
async function handleOAuthCallback(event) {
  // Verify the origin for security
  if (!event.data.code) {
    return;
  }

  try {
    showLoading('Getting user information...');

    // Exchange the code for user info
    const response = await fetch('/api/payouts/user-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: event.data.code,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get user information');
    }

    const userInfo = await response.json();
    displayUserInfo(userInfo);
    hideLoading();
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    alert('Error getting user information: ' + error.message);
    hideLoading();
  }
}

// Display user information
function displayUserInfo(userInfo) {
  currentUser = userInfo;

  const userDetails = document.getElementById('user-details');
  userDetails.innerHTML = `
    <div class="user-info-grid">
      <div class="user-info-item">
        <strong>Name:</strong> ${userInfo.name || 'N/A'}
      </div>
      <div class="user-info-item">
        <strong>Email:</strong> ${
          userInfo.email || userInfo.emails?.[0]?.value || 'N/A'
        }
      </div>
      <div class="user-info-item">
        <strong>PayPal ID (Payer ID):</strong> <code>${
          userInfo.payer_id || userInfo.user_id || 'N/A'
        }</code>
      </div>
      <div class="user-info-item">
        <strong>Account Type:</strong> ${userInfo.account_type || 'N/A'}
      </div>
      <div class="user-info-item">
        <strong>Verified:</strong> ${userInfo.verified_account ? 'Yes' : 'No'}
      </div>
    </div>
    <div style="margin-top: 15px;">
      <button class="btn-secondary" onclick="autofillRecipient()">Use This Account as Recipient</button>
      <button class="btn-secondary" onclick="logout()">Logout</button>
    </div>
  `;

  document.getElementById('user-info').style.display = 'block';
  document.getElementById('paypal-login-button').style.display = 'none';
}

// Autofill recipient with logged-in user's info
function autofillRecipient() {
  if (!currentUser) {
    alert('Please login first');
    return;
  }

  const firstRecipient = document.querySelector('.recipient-paypal-id');
  if (firstRecipient) {
    const payerId = currentUser.payer_id || currentUser.user_id;
    firstRecipient.value = payerId || '';
  }
}

// Logout
function logout() {
  currentUser = null;
  document.getElementById('user-info').style.display = 'none';
  document.getElementById('paypal-login-button').style.display = 'block';
}

// Add a new recipient
function addRecipient() {
  const container = document.getElementById('recipients-container');
  const newRecipient = document.createElement('div');
  newRecipient.className = 'recipient-item';
  newRecipient.innerHTML = `
    <div class="form-group">
      <label>Recipient PayPal ID:</label>
      <input type="text" class="recipient-paypal-id" placeholder="PayPal ID (payer_id)">
    </div>
    <div class="form-group">
      <label>Amount (USD):</label>
      <input type="number" class="recipient-amount" placeholder="10.00" step="0.01" min="0.01">
    </div>
    <div class="form-group">
      <label>Note:</label>
      <input type="text" class="recipient-note" placeholder="Optional note">
    </div>
    <button class="btn-remove" onclick="removeRecipient(this)">Remove</button>
  `;
  container.appendChild(newRecipient);
}

// Remove a recipient
function removeRecipient(button) {
  const recipientItem = button.closest('.recipient-item');
  const container = document.getElementById('recipients-container');

  // Don't allow removing the last recipient
  if (container.children.length > 1) {
    recipientItem.remove();
  } else {
    alert('You must have at least one recipient');
  }
}

// Create a payout
async function createPayout() {
  const senderBatchId = document.getElementById('sender-batch-id').value;
  const emailSubject = document.getElementById('email-subject').value;
  const emailMessage = document.getElementById('email-message').value;

  // Collect recipients
  const recipientItems = document.querySelectorAll('.recipient-item');
  const recipients = [];

  for (const item of recipientItems) {
    const paypalId = item.querySelector('.recipient-paypal-id').value;
    const amount = item.querySelector('.recipient-amount').value;
    const note = item.querySelector('.recipient-note').value;

    if (!paypalId || !amount) {
      alert(
        'Please fill in all required recipient fields (PayPal ID and amount)'
      );
      return;
    }

    recipients.push({
      receiver: paypalId,
      amount: amount,
      note: note || 'Thank you!',
      sender_item_id: `item_${Date.now()}_${recipients.length}`,
    });
  }

  if (recipients.length === 0) {
    alert('Please add at least one recipient');
    return;
  }

  try {
    showLoading('Creating payout...');

    const response = await fetch('/api/payouts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_batch_id: senderBatchId,
        email_subject: emailSubject,
        email_message: emailMessage,
        recipients: recipients,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create payout');
    }

    const result = await response.json();
    displayPayoutStatus(result);
    hideLoading();
  } catch (error) {
    console.error('Error creating payout:', error);
    alert('Error creating payout: ' + error.message);
    hideLoading();
  }
}

// Display payout status
function displayPayoutStatus(result) {
  const statusSection = document.getElementById('payout-status-section');
  const statusDiv = document.getElementById('payout-status');

  statusDiv.innerHTML = `
    <div class="success-box">
      <h3>✓ Payout Created Successfully!</h3>
      <div class="payout-details">
        <div class="detail-item">
          <strong>Payout Batch ID:</strong> <code>${
            result.batch_header.payout_batch_id
          }</code>
        </div>
        <div class="detail-item">
          <strong>Batch Status:</strong> ${result.batch_header.batch_status}
        </div>
        <div class="detail-item">
          <strong>Sender Batch ID:</strong> ${
            result.batch_header.sender_batch_header.sender_batch_id
          }
        </div>
        <div class="detail-item">
          <strong>Time Created:</strong> ${new Date(
            result.batch_header.time_created
          ).toLocaleString()}
        </div>
      </div>
      <button class="btn-primary" onclick="queryPayoutById('${
        result.batch_header.payout_batch_id
      }')">
        Check Status
      </button>
    </div>
    <details style="margin-top: 20px;">
      <summary>View Full Response</summary>
      <pre>${JSON.stringify(result, null, 2)}</pre>
    </details>
  `;

  statusSection.style.display = 'block';
  statusSection.scrollIntoView({ behavior: 'smooth' });
}

// Query payout by ID
async function queryPayout() {
  const batchId = document.getElementById('payout-batch-id').value;

  if (!batchId) {
    alert('Please enter a payout batch ID');
    return;
  }

  await queryPayoutById(batchId);
}

// Query payout by ID (helper function)
async function queryPayoutById(batchId) {
  try {
    showLoading('Querying payout...');

    const response = await fetch(`/api/payouts/${batchId}`);

    if (!response.ok) {
      throw new Error('Failed to query payout');
    }

    const result = await response.json();
    displayQueryResults(result);
    hideLoading();
  } catch (error) {
    console.error('Error querying payout:', error);
    alert('Error querying payout: ' + error.message);
    hideLoading();
  }
}

// Query payout item
async function queryPayoutItem() {
  const itemId = document.getElementById('payout-item-id').value;

  if (!itemId) {
    alert('Please enter a payout item ID');
    return;
  }

  try {
    showLoading('Querying payout item...');

    const response = await fetch(`/api/payouts/items/${itemId}`);

    if (!response.ok) {
      throw new Error('Failed to query payout item');
    }

    const result = await response.json();
    displayQueryResults(result);
    hideLoading();
  } catch (error) {
    console.error('Error querying payout item:', error);
    alert('Error querying payout item: ' + error.message);
    hideLoading();
  }
}

// Display query results
function displayQueryResults(result) {
  const queryResults = document.getElementById('query-results');
  const queryData = document.getElementById('query-data');

  queryData.textContent = JSON.stringify(result, null, 2);
  queryResults.style.display = 'block';
  queryResults.scrollIntoView({ behavior: 'smooth' });
}

// Show loading indicator
function showLoading(message) {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-overlay';
  loadingDiv.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(loadingDiv);
}

// Hide loading indicator
function hideLoading() {
  const loadingDiv = document.getElementById('loading-overlay');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// Listen for OAuth callback in popup
window.addEventListener('load', () => {
  // Check if this is the OAuth callback page
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code && window.opener) {
    // Send the code to the parent window
    window.opener.postMessage({ code: code }, window.location.origin);
    window.close();
  }
});
