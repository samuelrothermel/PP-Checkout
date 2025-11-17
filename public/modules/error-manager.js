// Error Console Management - Optional Module
// Simplified error suppression for PayPal-related console noise

class ErrorManager {
  constructor() {
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.suppressionEnabled = false;
    this.logSuppressedErrors = false;
    this.suppressedErrorCount = 0;
  }

  // Enable error suppression for PayPal-related messages
  enableSuppression(options = {}) {
    this.logSuppressedErrors = options.logSuppressed || false;
    this.suppressionEnabled = true;

    console.error = (...args) => {
      if (this.shouldSuppressError(args)) {
        this.suppressedErrorCount++;
        if (this.logSuppressedErrors) {
          console.warn('[Suppressed Error]', ...args);
        }
        return;
      }
      this.originalConsoleError.apply(console, args);
    };

    console.warn = (...args) => {
      if (this.shouldSuppressWarning(args)) {
        return;
      }
      this.originalConsoleWarn.apply(console, args);
    };

    console.log('PayPal error suppression enabled');
  }

  // Disable error suppression
  disableSuppression() {
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    this.suppressionEnabled = false;
    console.log(
      `PayPal error suppression disabled. Suppressed ${this.suppressedErrorCount} errors.`
    );
  }

  // Check if error should be suppressed
  shouldSuppressError(args) {
    const message = args[0]?.toString() || '';

    // PayPal postMessage errors
    if (
      message.includes('unable to post message to') &&
      (message.includes('paypal.com') || message.includes('sandbox.paypal.com'))
    ) {
      return true;
    }

    // CSP errors from PayPal iframes
    if (
      message.includes('Content Security Policy') &&
      (message.includes('paypal') || message.includes('braintree'))
    ) {
      return true;
    }

    // Common PayPal iframe communication errors
    if (
      message.includes('Failed to execute') &&
      message.includes('postMessage')
    ) {
      return true;
    }

    return false;
  }

  // Check if warning should be suppressed
  shouldSuppressWarning(args) {
    const message = args[0]?.toString() || '';

    // PayPal SDK warnings
    if (message.includes('PayPal') && message.includes('deprecated')) {
      return true;
    }

    return false;
  }

  // Get suppression statistics
  getStats() {
    return {
      enabled: this.suppressionEnabled,
      suppressedCount: this.suppressedErrorCount,
      logSuppressed: this.logSuppressedErrors,
    };
  }
}

// Export for use
window.ErrorManager = ErrorManager;

// Auto-initialize if needed
if (window.PayPalErrorSuppression !== false) {
  const errorManager = new ErrorManager();
  errorManager.enableSuppression({ logSuppressed: false });
  window.paypalErrorManager = errorManager;
}
