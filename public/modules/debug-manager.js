// Debug Manager - Optional Module
// Simplified debugging utilities for checkout process

class DebugManager {
  constructor() {
    this.enabled = false;
    this.logs = [];
    this.maxLogs = 100;
    this.startTime = Date.now();
  }

  // Enable debugging
  enable() {
    this.enabled = true;
    this.log('Debug mode enabled');
    this.attachToWindow();
  }

  // Disable debugging
  disable() {
    this.enabled = false;
    this.log('Debug mode disabled');
  }

  // Log with timestamp
  log(message, data = null) {
    const timestamp = Date.now() - this.startTime;
    const logEntry = {
      timestamp,
      message,
      data,
      time: new Date().toLocaleTimeString(),
    };

    this.logs.push(logEntry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if (this.enabled) {
      console.log(`[DEBUG +${timestamp}ms]`, message, data || '');
    }
  }

  // Debug PayPal SDK status
  debugPayPalSDK() {
    const status = {
      loaded: !!window.paypal,
      buttons: !!window.paypal?.Buttons,
      cardFields: !!window.paypal?.CardFields,
      marks: !!window.paypal?.Marks,
      messages: !!window.paypal?.Messages,
    };

    this.log('PayPal SDK Status', status);
    return status;
  }

  // Debug DOM elements
  debugDOM(selectors = []) {
    const defaultSelectors = [
      '#paypal-button-container',
      '#card-button-container',
      '#card-number-field-container',
      '#card-cvv-field-container',
      '#card-expiry-field-container',
      '#submit-order-button',
    ];

    const elements = {};
    [...defaultSelectors, ...selectors].forEach(selector => {
      const element = document.querySelector(selector);
      elements[selector] = {
        exists: !!element,
        visible: element ? element.style.display !== 'none' : false,
        hasContent: element ? element.innerHTML.length > 0 : false,
      };
    });

    this.log('DOM Elements Status', elements);
    return elements;
  }

  // Debug form data
  debugFormData() {
    const formData = {
      shipping: this.getFormSection('shipping'),
      billing: this.getFormSection('billing'),
      paymentMethod: document.querySelector(
        'input[name="payment-method"]:checked'
      )?.value,
      total: document.getElementById('amount-total')?.textContent,
    };

    this.log('Form Data', formData);
    return formData;
  }

  // Helper to get form section data
  getFormSection(prefix) {
    const fields = {};
    document.querySelectorAll(`[id^="${prefix}-"]`).forEach(input => {
      if (input.type !== 'button' && input.type !== 'submit') {
        fields[input.id] = {
          value: input.value,
          valid: input.checkValidity(),
        };
      }
    });
    return fields;
  }

  // Debug network requests
  debugNetworkRequest(url, method, data = null) {
    this.log(`Network Request: ${method} ${url}`, data);
  }

  // Debug network response
  debugNetworkResponse(url, status, data = null) {
    this.log(`Network Response: ${status} ${url}`, data);
  }

  // Get all logs
  getLogs() {
    return this.logs;
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.log('Logs cleared');
  }

  // Export logs as JSON
  exportLogs() {
    const exportData = {
      exported: new Date().toISOString(),
      sessionStart: new Date(
        Date.now() - (Date.now() - this.startTime)
      ).toISOString(),
      logs: this.logs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkout-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.log('Debug logs exported');
  }

  // Attach debug functions to window for console access
  attachToWindow() {
    window.debug = {
      paypal: () => this.debugPayPalSDK(),
      dom: selectors => this.debugDOM(selectors),
      form: () => this.debugFormData(),
      logs: () => this.getLogs(),
      clear: () => this.clearLogs(),
      export: () => this.exportLogs(),
      enable: () => this.enable(),
      disable: () => this.disable(),
    };

    console.log('Debug utilities attached to window.debug');
    console.log(
      'Available: debug.paypal(), debug.dom(), debug.form(), debug.logs(), debug.clear(), debug.export()'
    );
  }
}

// Export for use
window.DebugManager = DebugManager;

// Auto-initialize if debug mode requested
if (
  window.location.search.includes('debug=true') ||
  localStorage.getItem('paypal-debug') === 'true'
) {
  const debugManager = new DebugManager();
  debugManager.enable();
  window.paypalDebugManager = debugManager;
}
