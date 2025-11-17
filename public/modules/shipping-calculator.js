// Shipping Calculator - Optional Module
// Simplified shipping and tax calculations

class ShippingCalculator {
  constructor() {
    this.shippingRates = {
      US: {
        standard: { rate: 0, name: 'Free Shipping', days: '5-7' },
        expedited: { rate: 10, name: 'Expedited Shipping', days: '2-3' },
        overnight: { rate: 25, name: 'Overnight Shipping', days: '1' },
      },
      CA: {
        standard: { rate: 5, name: 'Standard Shipping', days: '7-10' },
        expedited: { rate: 15, name: 'Expedited Shipping', days: '3-5' },
      },
      default: {
        standard: { rate: 15, name: 'International Shipping', days: '10-14' },
        expedited: { rate: 35, name: 'Express International', days: '5-7' },
      },
    };

    this.taxRates = {
      US: {
        CA: 0.0875, // California
        NY: 0.08, // New York
        TX: 0.0625, // Texas
        FL: 0.06, // Florida
        default: 0.05,
      },
      CA: {
        default: 0.13, // HST
      },
      default: 0,
    };

    this.currentCalculation = null;
  }

  // Calculate shipping options for address
  calculateShipping(address, cartTotal = 0) {
    const country = address.countryCode || 'US';
    const state = address.state || '';

    const rates = this.shippingRates[country] || this.shippingRates.default;
    const options = [];

    Object.entries(rates).forEach(([type, info]) => {
      let finalRate = info.rate;

      // Free shipping thresholds
      if (type === 'standard' && cartTotal >= 75) {
        finalRate = 0;
      }

      options.push({
        id: `${country}-${type}`,
        type: type,
        name: info.name,
        rate: finalRate,
        estimatedDays: info.days,
        description: `${info.name} (${info.days} business days)`,
      });
    });

    return options;
  }

  // Calculate tax for address
  calculateTax(address, subtotal = 0) {
    if (subtotal <= 0) return 0;

    const country = address.countryCode || 'US';
    const state = address.state || '';

    const countryRates = this.taxRates[country] || { default: 0 };
    const taxRate = countryRates[state] || countryRates.default || 0;

    const taxAmount = subtotal * taxRate;

    return {
      rate: taxRate,
      amount: Math.round(taxAmount * 100) / 100,
      description: `Tax (${(taxRate * 100).toFixed(2)}%)`,
    };
  }

  // Calculate full order totals
  calculateOrderTotal(cartItems, shippingAddress, selectedShipping = null) {
    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    // Get shipping options
    const shippingOptions = this.calculateShipping(shippingAddress, subtotal);

    // Use selected shipping or default to first option
    const shipping = selectedShipping
      ? shippingOptions.find(opt => opt.id === selectedShipping)
      : shippingOptions[0];

    const shippingAmount = shipping ? shipping.rate : 0;

    // Calculate tax on subtotal + shipping
    const taxableAmount = subtotal + shippingAmount;
    const tax = this.calculateTax(shippingAddress, taxableAmount);

    // Calculate total
    const total = subtotal + shippingAmount + tax.amount;

    this.currentCalculation = {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: {
        selected: shipping,
        options: shippingOptions,
        amount: Math.round(shippingAmount * 100) / 100,
      },
      tax: {
        rate: tax.rate,
        amount: Math.round(tax.amount * 100) / 100,
        description: tax.description,
      },
      total: Math.round(total * 100) / 100,
      breakdown: {
        subtotal: Math.round(subtotal * 100) / 100,
        shipping: Math.round(shippingAmount * 100) / 100,
        tax: Math.round(tax.amount * 100) / 100,
        total: Math.round(total * 100) / 100,
      },
    };

    return this.currentCalculation;
  }

  // Update DOM with calculated totals
  updateOrderSummary(calculation = null) {
    const calc = calculation || this.currentCalculation;
    if (!calc) return false;

    try {
      // Update subtotal
      const subtotalEl = document.getElementById('cart-total');
      if (subtotalEl) subtotalEl.textContent = calc.subtotal.toFixed(2);

      // Update shipping
      const shippingEl = document.getElementById('shipping-amount');
      if (shippingEl) shippingEl.textContent = calc.shipping.amount.toFixed(2);

      // Update or add tax row
      this.updateTaxRow(calc.tax);

      // Update total
      const totalEl = document.getElementById('amount-total');
      if (totalEl) totalEl.textContent = calc.total.toFixed(2);

      return true;
    } catch (error) {
      console.error('Error updating order summary:', error);
      return false;
    }
  }

  // Update tax row in order summary
  updateTaxRow(tax) {
    let taxRow = document.getElementById('tax-row');

    if (tax.amount > 0) {
      if (!taxRow) {
        // Create tax row
        const orderSummary = document.querySelector('.order-summary');
        const totalRow = orderSummary?.querySelector('.order-row.total');

        if (totalRow) {
          taxRow = document.createElement('div');
          taxRow.id = 'tax-row';
          taxRow.className = 'order-row';
          taxRow.innerHTML = `
            <span>Tax:</span>
            <span>$<span id="tax-amount">${tax.amount.toFixed(2)}</span></span>
          `;
          totalRow.parentNode.insertBefore(taxRow, totalRow);
        }
      } else {
        // Update existing tax row
        const taxAmountEl = document.getElementById('tax-amount');
        if (taxAmountEl) taxAmountEl.textContent = tax.amount.toFixed(2);
      }
    } else if (taxRow) {
      // Remove tax row if no tax
      taxRow.remove();
    }
  }

  // Get current calculation
  getCurrentCalculation() {
    return this.currentCalculation;
  }

  // Add shipping rate for country/region
  addShippingRate(country, type, rateInfo) {
    if (!this.shippingRates[country]) {
      this.shippingRates[country] = {};
    }
    this.shippingRates[country][type] = rateInfo;
  }

  // Add tax rate for country/state
  addTaxRate(country, state, rate) {
    if (!this.taxRates[country]) {
      this.taxRates[country] = {};
    }
    this.taxRates[country][state] = rate;
  }

  // Get shipping rates for country
  getShippingRates(country) {
    return this.shippingRates[country] || this.shippingRates.default;
  }

  // Get tax rate for location
  getTaxRate(country, state) {
    const countryRates = this.taxRates[country] || { default: 0 };
    return countryRates[state] || countryRates.default || 0;
  }

  // Attach to window for console access
  attachToWindow() {
    window.shipping = {
      calculate: (address, cartTotal) =>
        this.calculateShipping(address, cartTotal),
      tax: (address, subtotal) => this.calculateTax(address, subtotal),
      total: (items, address, shipping) =>
        this.calculateOrderTotal(items, address, shipping),
      update: () => this.updateOrderSummary(),
      current: () => this.getCurrentCalculation(),
      rates: () => this.shippingRates,
      addRate: (country, type, info) =>
        this.addShippingRate(country, type, info),
    };
    console.log('Shipping calculator attached to window.shipping');
  }
}

// Export for use
window.ShippingCalculator = ShippingCalculator;

// Auto-initialize
const shippingCalculator = new ShippingCalculator();
if (window.location.search.includes('debug=true')) {
  shippingCalculator.attachToWindow();
}
window.paypalShippingCalculator = shippingCalculator;
