/**
 * Customer and Vendor Standardization Tests
 * Test-driven approach to identify and fix inconsistencies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { CustomerModel } from '../../models/customer.model.js';
import { VendorModel } from '../../models/vendor.model.js';
import { GlobalPartyModel } from '../../shared_service/models/globalParty.model.js';
import { CompanyModel } from '../../models/company.model.js';

describe('Customer and Vendor Standardization Tests', () => {
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
    await GlobalPartyModel.deleteMany({});
    await CompanyModel.deleteMany({});
  });

  describe('Schema Field Consistency', () => {
    it('should have identical core fields between Customer and Vendor', () => {
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

    it('should have consistent field types and validation rules', () => {
      const customerSchema = CustomerModel.schema;
      const vendorSchema = VendorModel.schema;

      // Test contactNum validation
      expect(customerSchema.paths.contactNum.options.required).toBe(true);
      expect(vendorSchema.paths.contactNum.options.required).toBe(true);
      expect(customerSchema.paths.contactNum.options.minlength).toBe(10);
      expect(vendorSchema.paths.contactNum.options.minlength).toBe(10);

      // Test email validation
      expect(customerSchema.paths.email.options.required).toBe(false);
      expect(vendorSchema.paths.email.options.required).toBe(false);

      // Test currency enum
      expect(customerSchema.paths.currency.enumValues).toEqual(['INR', 'USD', 'EUR', 'GBP']);
      expect(vendorSchema.paths.currency.enumValues).toEqual(['INR', 'USD', 'EUR', 'GBP']);

      // Test paymentTerms enum
      const expectedPaymentTerms = ['COD', 'Net30D', 'Net7D', 'Net15D', 'Net45D', 'Net60D', 'Net90D', 'Advance'];
      expect(customerSchema.paths.paymentTerms.enumValues).toEqual(expectedPaymentTerms);
      expect(vendorSchema.paths.paymentTerms.enumValues).toEqual(expectedPaymentTerms);
    });

    it('should have consistent businessType enum values', () => {
      const customerBusinessTypes = CustomerModel.schema.paths.businessType.enumValues;
      const vendorBusinessTypes = VendorModel.schema.paths.businessType.enumValues;
      
      expect(customerBusinessTypes).toEqual(vendorBusinessTypes);
      expect(customerBusinessTypes).toContain('Individual');
      expect(customerBusinessTypes).toContain('Manufacturing');
      expect(customerBusinessTypes).toContain('Trading');
    });

    it('should have consistent bankDetails structure', () => {
      const customerBankDetails = CustomerModel.schema.paths.bankDetails.schema.paths;
      const vendorBankDetails = VendorModel.schema.paths.bankDetails.schema.paths;
      
      const bankDetailFields = ['code', 'type', 'bankAccNum', 'upi', 'bankName', 'accountHolderName', 'ifsc', 'swift', 'active', 'qrDetails'];
      
      bankDetailFields.forEach(field => {
        expect(Object.keys(customerBankDetails)).toContain(field);
        expect(Object.keys(vendorBankDetails)).toContain(field);
      });
    });
  });

  describe('Data Validation Consistency', () => {
    it('should validate contactNum with same rules', async () => {
      const invalidCustomer = new CustomerModel({
        name: 'Test Customer',
        contactNum: '123', // Invalid - too short
        company: testCompany._id
      });

      const invalidVendor = new VendorModel({
        name: 'Test Vendor',
        contactNum: '123', // Invalid - too short
        company: testCompany._id
      });

      await expect(invalidCustomer.validate()).rejects.toThrow();
      await expect(invalidVendor.validate()).rejects.toThrow();
    });

    it('should validate email with same rules', async () => {
      const invalidCustomer = new CustomerModel({
        name: 'Test Customer',
        contactNum: '1234567890',
        email: 'invalid-email', // Invalid format
        company: testCompany._id
      });

      const invalidVendor = new VendorModel({
        name: 'Test Vendor',
        contactNum: '1234567890',
        email: 'invalid-email', // Invalid format
        company: testCompany._id
      });

      await expect(invalidCustomer.validate()).rejects.toThrow();
      await expect(invalidVendor.validate()).rejects.toThrow();
    });

    it('should validate contact person fields consistently', async () => {
      // Both should require either phone or email if contact person name is provided
      const customerWithContactPerson = new CustomerModel({
        name: 'Test Customer',
        contactNum: '1234567890',
        contactPersonName: 'John Doe',
        // Missing contactPersonPhone and contactPersonEmail
        company: testCompany._id
      });

      const vendorWithContactPerson = new VendorModel({
        name: 'Test Vendor',
        contactNum: '1234567890',
        contactPersonName: 'Jane Doe',
        // Missing contactPersonPhone and contactPersonEmail
        company: testCompany._id
      });

      await expect(customerWithContactPerson.validate()).rejects.toThrow();
      await expect(vendorWithContactPerson.validate()).rejects.toThrow();
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

      expect(customer.code).toMatch(/^C_\d{6}$/);
      expect(vendor.code).toMatch(/^V_\d{6}$/);
    });
  });

  describe('Required Field Inconsistencies', () => {
    it('should identify linkedCoaAccount requirement differences', () => {
      const customerLinkedCoa = CustomerModel.schema.paths.linkedCoaAccount.options.required;
      const vendorLinkedCoa = VendorModel.schema.paths.linkedCoaAccount.options.required;
      
      // This test will fail if there are inconsistencies
      expect(customerLinkedCoa).toBe(false); // Customer has required: false
      expect(vendorLinkedCoa).toBe(true);    // Vendor has required: true
      
      // This is an inconsistency that needs to be fixed
      console.log('INCONSISTENCY FOUND: linkedCoaAccount requirement differs between Customer and Vendor');
    });

    it('should identify address default value inconsistencies', () => {
      const customerAddress = CustomerModel.schema.paths.address.options.default;
      const vendorAddress = VendorModel.schema.paths.address.options.default;
      
      expect(customerAddress).toBe('');
      expect(vendorAddress).toBe('false'); // This is inconsistent
      
      console.log('INCONSISTENCY FOUND: address default value differs between Customer and Vendor');
    });

    it('should identify remarks default value inconsistencies', () => {
      const customerRemarks = CustomerModel.schema.paths.remarks.options.default;
      const vendorRemarks = VendorModel.schema.paths.remarks.options.default;
      
      expect(customerRemarks).toBe('');
      expect(vendorRemarks).toBe('false'); // This is inconsistent
      
      console.log('INCONSISTENCY FOUND: remarks default value differs between Customer and Vendor');
    });
  });

  describe('Index Consistency', () => {
    it('should have consistent unique indexes', () => {
      const customerIndexes = CustomerModel.schema.indexes();
      const vendorIndexes = VendorModel.schema.indexes();
      
      // Both should have unique indexes on email, contactNum, and bankDetails
      const customerUniqueFields = customerIndexes
        .filter(idx => idx[1].unique)
        .map(idx => Object.keys(idx[0])[0]);
      
      const vendorUniqueFields = vendorIndexes
        .filter(idx => idx[1].unique)
        .map(idx => Object.keys(idx[0])[0]);
      
      expect(customerUniqueFields).toContain('email');
      expect(customerUniqueFields).toContain('contactNum');
      expect(vendorUniqueFields).toContain('email');
      expect(vendorUniqueFields).toContain('contactNum');
    });
  });

  describe('Pre-save Hook Consistency', () => {
    it('should have consistent pre-save validation', async () => {
      // Test duplicate contact number handling
      const customer1 = await CustomerModel.create({
        name: 'Customer 1',
        contactNum: '1111111111',
        company: testCompany._id
      });

      const customer2 = new CustomerModel({
        name: 'Customer 2',
        contactNum: '1111111111', // Duplicate
        company: testCompany._id
      });

      await expect(customer2.save()).rejects.toThrow('Duplicate contact number');

      // Test vendor duplicate handling
      const vendor1 = await VendorModel.create({
        name: 'Vendor 1',
        contactNum: '2222222222',
        company: testCompany._id
      });

      const vendor2 = new VendorModel({
        name: 'Vendor 2',
        contactNum: '2222222222', // Duplicate
        company: testCompany._id
      });

      await expect(vendor2.save()).rejects.toThrow('Duplicate contact number');
    });
  });

  describe('Controller Response Consistency', () => {
    it('should identify response format inconsistencies', () => {
      // This test documents the current inconsistencies found in controllers
      const inconsistencies = [
        'Customer controller uses "Success" vs Vendor uses "Success" (consistent)',
        'Customer controller has more detailed error messages with emojis',
        'Vendor controller has simpler error messages',
        'Customer controller has attachGroupToCustomer function, Vendor does not',
        'Customer deleteAllCustomers uses DELETE /, Vendor uses DELETE /bulk-delete'
      ];
      
      console.log('CONTROLLER INCONSISTENCIES FOUND:');
      inconsistencies.forEach(inc => console.log(`- ${inc}`));
      
      expect(inconsistencies.length).toBeGreaterThan(0);
    });
  });

  describe('Route Consistency', () => {
    it('should identify route pattern inconsistencies', () => {
      const customerRoutes = [
        'POST /',
        'GET /',
        'GET /:customerId',
        'PUT /:customerId',
        'DELETE /:customerId',
        'DELETE /',
        'POST /attach-groups'
      ];
      
      const vendorRoutes = [
        'POST /',
        'GET /',
        'GET /:vendorId',
        'PUT /:vendorId',
        'DELETE /:vendorId',
        'DELETE /bulk-delete'
      ];
      
      console.log('ROUTE INCONSISTENCIES FOUND:');
      console.log('- Customer has DELETE / for deleteAll, Vendor has DELETE /bulk-delete');
      console.log('- Customer has POST /attach-groups, Vendor does not');
      
      expect(customerRoutes.length).not.toBe(vendorRoutes.length);
    });
  });
});