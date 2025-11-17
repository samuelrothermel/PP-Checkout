// Module Loader - Easy way to include optional checkout features

class CheckoutModuleLoader {
  constructor() {
    this.loadedModules = new Set();
    this.basePath = '/modules/';
    this.modules = {
      'error-manager': {
        file: 'error-manager.js',
        description: 'Suppress PayPal console errors and warnings',
        autoInit: true,
      },
      'debug-manager': {
        file: 'debug-manager.js',
        description: 'Debug utilities for checkout process',
        autoInit: true,
        condition: () =>
          window.location.search.includes('debug=true') ||
          localStorage.getItem('paypal-debug') === 'true',
      },
      'storage-manager': {
        file: 'storage-manager.js',
        description:
          'LocalStorage management for orders, customers, preferences',
        autoInit: true,
      },
      'shipping-calculator': {
        file: 'shipping-calculator.js',
        description: 'Advanced shipping and tax calculations',
        autoInit: true,
      },
    };
  }

  // Load a specific module
  async loadModule(moduleName) {
    if (this.loadedModules.has(moduleName)) {
      console.log(`Module ${moduleName} already loaded`);
      return true;
    }

    const moduleConfig = this.modules[moduleName];
    if (!moduleConfig) {
      console.error(`Unknown module: ${moduleName}`);
      return false;
    }

    // Check condition if specified
    if (moduleConfig.condition && !moduleConfig.condition()) {
      console.log(`Module ${moduleName} condition not met, skipping`);
      return false;
    }

    try {
      await this.loadScript(this.basePath + moduleConfig.file);
      this.loadedModules.add(moduleName);
      console.log(`✓ Loaded module: ${moduleName}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to load module ${moduleName}:`, error);
      return false;
    }
  }

  // Load multiple modules
  async loadModules(moduleNames) {
    const results = {};
    for (const moduleName of moduleNames) {
      results[moduleName] = await this.loadModule(moduleName);
    }
    return results;
  }

  // Load all available modules
  async loadAllModules() {
    const moduleNames = Object.keys(this.modules);
    return await this.loadModules(moduleNames);
  }

  // Load only modules that meet their conditions
  async loadConditionalModules() {
    const moduleNames = Object.keys(this.modules).filter(name => {
      const config = this.modules[name];
      return !config.condition || config.condition();
    });
    return await this.loadModules(moduleNames);
  }

  // Load script utility
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Get module status
  getModuleStatus() {
    const status = {};
    Object.keys(this.modules).forEach(name => {
      const config = this.modules[name];
      status[name] = {
        loaded: this.loadedModules.has(name),
        description: config.description,
        conditionMet: !config.condition || config.condition(),
      };
    });
    return status;
  }

  // Enhanced checkout integration - extends the simplified checkout
  integrateWithCheckout(checkoutApp) {
    if (!checkoutApp) {
      console.error('CheckoutApp instance required for integration');
      return false;
    }

    // Extend Utils with storage
    if (
      this.loadedModules.has('storage-manager') &&
      window.paypalStorageManager
    ) {
      checkoutApp.Utils.storage = window.paypalStorageManager;

      // Auto-save orders
      const originalApprove = checkoutApp.PayPalIntegration.approveOrder;
      checkoutApp.PayPalIntegration.approveOrder = async function (data) {
        const result = await originalApprove.call(this, data);

        // Save order to storage
        if (result && result.id) {
          checkoutApp.Utils.storage.saveOrder(result.id, {
            amount: checkoutApp.Utils.getCurrentTotal(),
            paymentMethod: document.querySelector(
              'input[name="payment-method"]:checked'
            )?.value,
            status: result.status,
          });
        }

        return result;
      };
    }

    // Extend with shipping calculator
    if (
      this.loadedModules.has('shipping-calculator') &&
      window.paypalShippingCalculator
    ) {
      checkoutApp.Utils.shipping = window.paypalShippingCalculator;

      // Auto-calculate shipping on address changes
      const addressFields = ['shipping-country-code', 'shipping-admin-area1'];
      addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.addEventListener('change', () => {
            const shippingData =
              checkoutApp.PayPalIntegration.getShippingData();
            const cartTotal = parseFloat(
              document.getElementById('cart-total')?.textContent || '0'
            );
            const options = checkoutApp.Utils.shipping.calculateShipping(
              shippingData,
              cartTotal
            );
            console.log('Updated shipping options:', options);
          });
        }
      });
    }

    // Extend with debug capabilities
    if (this.loadedModules.has('debug-manager') && window.paypalDebugManager) {
      checkoutApp.Utils.debug = window.paypalDebugManager;

      // Auto-debug API calls
      const originalCreateOrder = checkoutApp.PayPalIntegration.createOrder;
      checkoutApp.PayPalIntegration.createOrder = async function () {
        checkoutApp.Utils.debug.log('Creating PayPal order...');
        checkoutApp.Utils.debug.debugFormData();

        try {
          const result = await originalCreateOrder.call(this);
          checkoutApp.Utils.debug.log('Order created successfully', {
            orderId: result,
          });
          return result;
        } catch (error) {
          checkoutApp.Utils.debug.log('Order creation failed', error);
          throw error;
        }
      };
    }

    console.log('Checkout modules integrated successfully');
    return true;
  }

  // Attach to window for easy access
  attachToWindow() {
    window.checkoutModules = {
      load: moduleName => this.loadModule(moduleName),
      loadAll: () => this.loadAllModules(),
      loadConditional: () => this.loadConditionalModules(),
      status: () => this.getModuleStatus(),
      integrate: app => this.integrateWithCheckout(app),
    };
    console.log('Module loader attached to window.checkoutModules');
  }
}

// Auto-initialize
const moduleLoader = new CheckoutModuleLoader();
moduleLoader.attachToWindow();

// Export
window.CheckoutModuleLoader = CheckoutModuleLoader;
window.paypalModuleLoader = moduleLoader;

// Auto-load conditional modules
document.addEventListener('DOMContentLoaded', () => {
  moduleLoader.loadConditionalModules().then(results => {
    const loaded = Object.entries(results).filter(([name, success]) => success);
    if (loaded.length > 0) {
      console.log(
        `Auto-loaded ${loaded.length} checkout modules:`,
        loaded.map(([name]) => name)
      );
    }
  });
});
