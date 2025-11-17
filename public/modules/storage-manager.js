// Storage Manager - Optional Module
// Simplified localStorage management for checkout data

class StorageManager {
  constructor() {
    this.prefix = 'paypal-checkout-';
    this.maxItems = 20;
  }

  // Save order ID
  saveOrder(orderId, metadata = {}) {
    try {
      const orders = this.getOrders();
      const orderData = {
        id: orderId,
        timestamp: new Date().toISOString(),
        amount: metadata.amount,
        paymentMethod: metadata.paymentMethod,
        status: metadata.status || 'created',
      };

      orders.unshift(orderData);

      // Keep only recent orders
      if (orders.length > this.maxItems) {
        orders.splice(this.maxItems);
      }

      this.setItem('orders', orders);
      console.log('Order saved to localStorage:', orderId);
      return true;
    } catch (error) {
      console.error('Error saving order:', error);
      return false;
    }
  }

  // Get all saved orders
  getOrders() {
    return this.getItem('orders', []);
  }

  // Save customer ID
  saveCustomer(customerId, metadata = {}) {
    try {
      const customers = this.getCustomers();
      const customerData = {
        id: customerId,
        timestamp: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        paymentMethods: metadata.paymentMethods || [],
      };

      // Remove existing entry if present
      const filtered = customers.filter(c => c.id !== customerId);
      filtered.unshift(customerData);

      // Keep only recent customers
      if (filtered.length > 10) {
        filtered.splice(10);
      }

      this.setItem('customers', filtered);
      console.log('Customer saved to localStorage:', customerId);
      return true;
    } catch (error) {
      console.error('Error saving customer:', error);
      return false;
    }
  }

  // Get all saved customers
  getCustomers() {
    return this.getItem('customers', []);
  }

  // Save shipping address
  saveShippingAddress(addressData) {
    try {
      const addresses = this.getShippingAddresses();
      const address = {
        ...addressData,
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };

      addresses.unshift(address);

      // Keep only recent addresses
      if (addresses.length > 5) {
        addresses.splice(5);
      }

      this.setItem('shipping-addresses', addresses);
      console.log('Shipping address saved');
      return address.id;
    } catch (error) {
      console.error('Error saving shipping address:', error);
      return null;
    }
  }

  // Get saved shipping addresses
  getShippingAddresses() {
    return this.getItem('shipping-addresses', []);
  }

  // Save checkout preferences
  savePreferences(preferences) {
    try {
      const current = this.getPreferences();
      const updated = {
        ...current,
        ...preferences,
        lastUpdated: new Date().toISOString(),
      };
      this.setItem('preferences', updated);
      console.log('Preferences saved');
      return true;
    } catch (error) {
      console.error('Error saving preferences:', error);
      return false;
    }
  }

  // Get checkout preferences
  getPreferences() {
    return this.getItem('preferences', {
      defaultPaymentMethod: 'paypal',
      saveShippingAddress: true,
      enableDebugMode: false,
      suppressErrors: true,
    });
  }

  // Generic get item with error handling
  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  // Generic set item with error handling
  setItem(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
      return false;
    }
  }

  // Remove item
  removeItem(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
      return false;
    }
  }

  // Clear all checkout data
  clearAll() {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.prefix)
      );
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keys.length} checkout items from localStorage`);
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  // Get storage statistics
  getStats() {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.prefix)
      );
      const stats = {
        totalKeys: keys.length,
        orders: this.getOrders().length,
        customers: this.getCustomers().length,
        addresses: this.getShippingAddresses().length,
        hasPreferences: !!localStorage.getItem(this.prefix + 'preferences'),
      };
      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return null;
    }
  }

  // Export all data
  exportData() {
    try {
      const data = {
        exported: new Date().toISOString(),
        orders: this.getOrders(),
        customers: this.getCustomers(),
        addresses: this.getShippingAddresses(),
        preferences: this.getPreferences(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkout-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('Checkout data exported');
      return true;
    } catch (error) {
      console.error('Error exporting data:', error);
      return false;
    }
  }

  // Generate simple ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Attach to window for console access
  attachToWindow() {
    window.storage = {
      orders: () => this.getOrders(),
      customers: () => this.getCustomers(),
      addresses: () => this.getShippingAddresses(),
      preferences: () => this.getPreferences(),
      stats: () => this.getStats(),
      clear: () => this.clearAll(),
      export: () => this.exportData(),
    };
    console.log('Storage utilities attached to window.storage');
  }
}

// Export for use
window.StorageManager = StorageManager;

// Auto-initialize
const storageManager = new StorageManager();
if (window.location.search.includes('debug=true')) {
  storageManager.attachToWindow();
}
window.paypalStorageManager = storageManager;
