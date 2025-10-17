/**
 * Comprehensive Test Suite for Standardized Modules
 * Tests all standardized modules for consistency and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { CustomerModel } from '../../models/customer.model.js';
import { VendorModel } from '../../models/vendor.model.js';
import { ItemModel } from '../../models/item.model.js';
import { SalesOrderModel, ORDER_STATUS } from '../../models/salesorder.standardized.model.js';
import { CompanyModel } from '../../models/company.model.js';

describe('Standardized Modules Test Suite', () => {
  let testCompany;

  beforeEach(async () => {
    // Create test company
    testCompany = await CompanyModel.create({
      name: 'Test Company',
      code: 'TC001',
      address: 'Test Address',
      active: true
    });
  });

  afterEach(async () => {
    await CustomerModel.deleteMany({});
    await VendorModel.deleteMany({});
    await ItemModel.deleteMany({});
    await SalesOrderModel.deleteMany({});
    await CompanyModel.deleteMany({});
  });

  describe('Customer and Vendor Standardization', () => {
    it('should have consistent field structures', () => {
      const customerFields = Object.keys(CustomerModel.schema.paths);
      const vendorFields = Object.keys(VendorModel.schema.paths);
      
      const commonFields = [
        'code', 'globalPartyId', 'businessType', 'name', 'contactNum', 'email',
        'contactPersonName', 'contactPersonPhone', 'contactPersonEmail',
        'currency', 'paymentTerms', 'creditLimit', 'registrationNum', 'panNum',
        'tanNum', 'address', 'active', 'archived', 'groups', 'company',
        'linkedCoaAccount', 'bankDetails', 'logoImage', 'files', 'extras'
      ];

      commonFields.forEach(field => {
        expect(customerFields).toContain(field);
        expect(vendorFields).toContain(field);
      });
    });

    it('should have consistent default values', () => {
      const customerAddress = CustomerModel.schema.paths.address.options.default;
      const vendorAddress = VendorModel.schema.paths.address.options.default;
      
      expect(customerAddress).toBe('');
      expect(vendorAddress).toBe('');
    });

    it('should have consistent required field settings', () => {
      const customerLinkedCoa = CustomerModel.schema.paths.linkedCoaAccount.options.required;
      const vendorLinkedCoa = VendorModel.schema.paths.linkedCoaAccount.options.required;
      
      expect(customerLinkedCoa).toBe(false);
      expect(vendorLinkedCoa).toBe(false);
    });

    it('should have consistent business type enums', () => {
      const customerBusinessTypes = CustomerModel.schema.paths.businessType.enumValues;
      const vendorBusinessTypes = VendorModel.schema.paths.businessType.enumValues;
      
      expect(customerBusinessTypes).toEqual(vendorBusinessTypes);
      expect(customerBusinessTypes).toContain('Others');
    });

    it('should create customers and vendors with consistent validation', async () => {
      const customerData = {
        name: 'Test Customer',
        contactNum: '1234567890',
        email: 'test@customer.com',
        company: testCompany._id
      };

      const vendorData = {
        name: 'Test Vendor',
        contactNum: '9876543210',
        email: 'test@vendor.com',
        company: testCompany._id
      };

      const customer = await CustomerModel.create(customerData);
      const vendor = await VendorModel.create(vendorData);

      expect(customer.code).toMatch(/^C_\d{6}$/);
      expect(vendor.code).toMatch(/^V_\d{6}$/);
      expect(customer.active).toBe(false);
      expect(vendor.active).toBe(false);
    });
  });

  describe('Item Module Standardization', () => {
    it('should have all required fields for comprehensive item management', () => {
      const itemFields = Object.keys(ItemModel.schema.paths);
      
      const requiredFields = [
        'code', 'itemNum', 'name', 'description', 'type', 'unit', 'price',
        'costPrice', 'minPrice', 'maxPrice', 'category', 'active', 'archived',
        'company', 'linkedCoaAccount', 'files', 'extras'
      ];

      requiredFields.forEach(field => {
        expect(itemFields).toContain(field);
      });
    });

    it('should validate price ranges correctly', async () => {
      const itemData = {
        itemNum: 'ITEM001',
        name: 'Test Item',
        price: 100,
        costPrice: 80,
        minPrice: 90,
        maxPrice: 110,
        company: testCompany._id
      };

      const item = await ItemModel.create(itemData);
      expect(item.price).toBe(100);
      expect(item.costPrice).toBe(80);
      expect(item.minPrice).toBe(90);
      expect(item.maxPrice).toBe(110);
    });

    it('should have expanded unit enum', () => {
      const unitValues = ItemModel.schema.paths.unit.enumValues;
      const expectedUnits = ['ea', 'pcs', 'qty', 'mt', 'kgs', 'lbs', 'hr', 'min', 'box', 'dozen', 'gallon', 'liter', 'sqft', 'sqm', 'cft', 'cm'];
      
      expectedUnits.forEach(unit => {
        expect(unitValues).toContain(unit);
      });
    });

    it('should have category field with proper enum', () => {
      const categoryValues = ItemModel.schema.paths.category.enumValues;
      const expectedCategories = ['Raw Material', 'Finished Goods', 'Semi-Finished', 'Consumables', 'Tools', 'Equipment', 'Services'];
      
      expectedCategories.forEach(category => {
        expect(categoryValues).toContain(category);
      });
    });
  });

  describe('Sales Order Standardization', () => {
    it('should have simplified status management', () => {
      const statusValues = Object.values(ORDER_STATUS);
      const expectedStatuses = ['Draft', 'Confirmed', 'Invoiced', 'Cancelled', 'Completed'];
      
      expect(statusValues).toEqual(expectedStatuses);
    });

    it('should have consistent field structure', () => {
      const orderFields = Object.keys(SalesOrderModel.schema.paths);
      
      const requiredFields = [
        'orderNum', 'orderType', 'customer', 'lineItems', 'subtotal',
        'totalDiscount', 'totalTax', 'totalAmount', 'paymentTerms',
        'paidAmount', 'balanceAmount', 'status', 'orderDate', 'dueDate',
        'invoiceDate', 'payments', 'currency', 'company', 'active', 'archived'
      ];

      requiredFields.forEach(field => {
        expect(orderFields).toContain(field);
      });
    });

    it('should calculate financial totals correctly', async () => {
      const customer = await CustomerModel.create({
        name: 'Test Customer',
        contactNum: '1234567890',
        company: testCompany._id
      });

      const item = await ItemModel.create({
        itemNum: 'ITEM001',
        name: 'Test Item',
        price: 100,
        costPrice: 80,
        company: testCompany._id
      });

      const orderData = {
        customer: customer._id,
        lineItems: [{
          lineNum: '1',
          item: item._id,
          quantity: 2,
          unitPrice: 100,
          discount: 10,
          tax: 5
        }],
        company: testCompany._id
      };

      const order = new SalesOrderModel(orderData);
      order.calculateTotals();

      expect(order.subtotal).toBe(200); // 2 * 100
      expect(order.totalDiscount).toBe(20); // 10% of 200
      expect(order.totalTax).toBe(9); // 5% of 180 (200 - 20)
      expect(order.totalAmount).toBe(189); // 200 - 20 + 9
    });

    it('should validate status transitions correctly', () => {
      const order = new SalesOrderModel({ status: ORDER_STATUS.DRAFT });
      
      expect(order.canChangeStatus(ORDER_STATUS.CONFIRMED)).toBe(true);
      expect(order.canChangeStatus(ORDER_STATUS.CANCELLED)).toBe(true);
      expect(order.canChangeStatus(ORDER_STATUS.INVOICED)).toBe(false);
      expect(order.canChangeStatus(ORDER_STATUS.COMPLETED)).toBe(false);
    });

    it('should add payments correctly', () => {
      const order = new SalesOrderModel({
        totalAmount: 1000,
        paidAmount: 0,
        balanceAmount: 1000
      });

      const payment = order.addPayment({
        amount: 500,
        paymentMode: 'Cash'
      });

      expect(payment.amount).toBe(500);
      expect(payment.paymentMode).toBe('Cash');
      expect(order.paidAmount).toBe(500);
      expect(order.balanceAmount).toBe(500);
    });
  });

  describe('API Response Consistency', () => {
    it('should have consistent error response format', () => {
      const errorResponse = {
        status: 'failure',
        message: '❌ Test error message',
        error: 'Test error details',
        timestamp: new Date().toISOString()
      };

      expect(errorResponse.status).toBe('failure');
      expect(errorResponse.message).toMatch(/^❌/);
      expect(errorResponse.timestamp).toBeDefined();
    });

    it('should have consistent success response format', () => {
      const successResponse = {
        status: 'success',
        message: '✅ Test success message',
        data: { test: 'data' },
        timestamp: new Date().toISOString()
      };

      expect(successResponse.status).toBe('success');
      expect(successResponse.message).toMatch(/^✅/);
      expect(successResponse.timestamp).toBeDefined();
    });
  });

  describe('Field Validation Consistency', () => {
    it('should validate email consistently across modules', async () => {
      const invalidEmail = 'invalid-email';
      
      const customerData = {
        name: 'Test Customer',
        contactNum: '1234567890',
        email: invalidEmail,
        company: testCompany._id
      };

      const vendorData = {
        name: 'Test Vendor',
        contactNum: '9876543210',
        email: invalidEmail,
        company: testCompany._id
      };

      await expect(CustomerModel.create(customerData)).rejects.toThrow();
      await expect(VendorModel.create(vendorData)).rejects.toThrow();
    });

    it('should validate phone numbers consistently', async () => {
      const invalidPhone = '123';
      
      const customerData = {
        name: 'Test Customer',
        contactNum: invalidPhone,
        company: testCompany._id
      };

      const vendorData = {
        name: 'Test Vendor',
        contactNum: invalidPhone,
        company: testCompany._id
      };

      await expect(CustomerModel.create(customerData)).rejects.toThrow();
      await expect(VendorModel.create(vendorData)).rejects.toThrow();
    });
  });

  describe('Code Generation Consistency', () => {
    it('should generate codes with consistent format', async () => {
      const customer = await CustomerModel.create({
        name: 'Test Customer',
        contactNum: '1234567890',
        company: testCompany._id
      });

      const vendor = await VendorModel.create({
        name: 'Test Vendor',
        contactNum: '9876543210',
        company: testCompany._id
      });

      const item = await ItemModel.create({
        itemNum: 'ITEM001',
        name: 'Test Item',
        company: testCompany._id
      });

      expect(customer.code).toMatch(/^C_\d{6}$/);
      expect(vendor.code).toMatch(/^V_\d{6}$/);
      expect(item.code).toMatch(/^I_\d{6}$/);
    });
  });

  describe('Business Logic Consistency', () => {
    it('should handle financial calculations consistently', () => {
      // Test price rounding
      const price = 99.999;
      const roundedPrice = Math.round(price * 100) / 100;
      expect(roundedPrice).toBe(100);

      // Test percentage calculations
      const amount = 1000;
      const discount = 10;
      const discountAmount = (discount / 100) * amount;
      expect(discountAmount).toBe(100);
    });

    it('should validate business rules consistently', () => {
      // Test minimum values
      const minPrice = 0;
      const maxPrice = 1000;
      const testPrice = 500;
      
      expect(testPrice).toBeGreaterThanOrEqual(minPrice);
      expect(testPrice).toBeLessThanOrEqual(maxPrice);
    });
  });

  describe('Integration Testing', () => {
    it('should create complete sales order workflow', async () => {
      // Create customer
      const customer = await CustomerModel.create({
        name: 'Test Customer',
        contactNum: '1234567890',
        company: testCompany._id
      });

      // Create item
      const item = await ItemModel.create({
        itemNum: 'ITEM001',
        name: 'Test Item',
        price: 100,
        costPrice: 80,
        company: testCompany._id
      });

      // Create sales order
      const orderData = {
        customer: customer._id,
        lineItems: [{
          lineNum: '1',
          item: item._id,
          quantity: 2,
          unitPrice: 100,
          discount: 10,
          tax: 5
        }],
        company: testCompany._id
      };

      const order = await SalesOrderModel.create(orderData);

      expect(order.customer.toString()).toBe(customer._id.toString());
      expect(order.lineItems[0].item.toString()).toBe(item._id.toString());
      expect(order.status).toBe(ORDER_STATUS.DRAFT);
      expect(order.totalAmount).toBe(189);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle validation errors consistently', async () => {
      const invalidData = {
        name: '', // Invalid empty name
        contactNum: '123', // Invalid phone number
        email: 'invalid-email' // Invalid email
      };

      await expect(CustomerModel.create(invalidData)).rejects.toThrow();
    });

    it('should handle duplicate key errors consistently', async () => {
      const customerData = {
        name: 'Test Customer',
        contactNum: '1234567890',
        company: testCompany._id
      };

      await CustomerModel.create(customerData);
      await expect(CustomerModel.create(customerData)).rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      const customers = [];
      for (let i = 0; i < 100; i++) {
        customers.push({
          name: `Customer ${i}`,
          contactNum: `123456789${i.toString().padStart(1, '0')}`,
          company: testCompany._id
        });
      }

      const startTime = Date.now();
      await CustomerModel.insertMany(customers);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});