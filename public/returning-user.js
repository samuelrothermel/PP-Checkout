document
  .getElementById('customer-id-form')
  .addEventListener('submit', async event => {
    event.preventDefault();
    const customerId = document.getElementById('customer-id').value;

    // Fetch ID token for the customer
    const idTokenResponse = await fetch('/api/returning-user-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId }),
    });

    const { idToken } = await idTokenResponse.json();
    console.log('id_token: ', idToken);

    if (idToken) {
      console.log('returned idToken: ', idToken);

      // Redirect to new checkout page with idToken in the URL
      window.location.href = `/checkout?data-user-id-token=${idToken}`;
    } else {
      alert('Failed to fetch ID token for this customer.');
    }
  });
