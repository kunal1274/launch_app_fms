/**
 * Complete ERP Workflow End-to-End Tests
 * Tests the complete business workflow from purchase to sales to inventory to GL
 */

import request from 'supertest';
import app from '../../index.js';
import { CompanyModel } from '../../models/company.model.js';
import { CustomerModel } from '../../models/customer.model.js';
import { VendorModel } from '../../models/vendor.model.js';
import { ItemModel } from '../../models/item.model.js';
import { SalesOrderModel } from '../../models/salesorder.model.js';
import { PurchaseOrderModel } from '../../models/purchaseorder.model.js';
import { AccountModel } from '../../models/account.model.js';
import { SiteModel } from '../../models/site.model.js';
import { WarehouseModel } from '../../models/warehouse.model.js';
import { ZoneModel } from '../../models/zone.model.js';
import { LocationModel } from '../../models/location.model.js';
import { AisleModel } from '../../models/aisle.model.js';
import { RackModel } from '../../models/rack.model.js';
import { ShelfModel } from '../../models/shelf.model.js';
import { BinModel } from '../../models/bin.model.js';

describe('Complete ERP Workflow End-to-End Tests', () => {
  let testCompany;
  let testCustomer;
  let testVendor;
  let testItem;
  let testSite;
  let testWarehouse;
  let testZone;
  let testLocation;
  let testAisle;
  let testRack;
  let testShelf;
  let testBin;
  let testAssetAccount;
  let testRevenueAccount;
  let testExpenseAccount;

  beforeAll(async () => {
    // Create test company
    testCompany = await CompanyModel.create({
      name: 'Test Company',
      code: 'TC001',
      address: 'Test Address',
      active: true
    });

    // Create test customer
    testCustomer = await CustomerModel.create({
      name: 'Test Customer',
      email: 'test@customer.com',
      contactNum: '1234567890',
      address: 'Test Customer Address',
      company: testCompany._id,
      active: true
    });

    // Create test vendor
    testVendor = await VendorModel.create({
      name: 'Test Vendor',
      email: 'test@vendor.com',
      contactNum: '1234567890',
      address: 'Test Vendor Address',
      company: testCompany._id,
      active: true
    });

    // Create test item
    testItem = await ItemModel.create({
      name: 'Test Product',
      description: 'Test Product Description',
      type: 'Goods',
      unit: 'PCS',
      price: 100.00,
      costPrice: 80.00,
      active: true
    });

    // Create inventory dimensions
    testSite = await SiteModel.create({
      code: 'SITE001',
      name: 'Test Site',
      description: 'Test Site Description',
      address: 'Test Site Address',
      active: true,
      company: testCompany._id
    });

    testWarehouse = await WarehouseModel.create({
      code: 'WH001',
      name: 'Test Warehouse',
      site: testSite._id,
      address: 'Test Warehouse Address',
      active: true,
      company: testCompany._id
    });

    testZone = await ZoneModel.create({
      code: 'ZONE001',
      name: 'Test Zone',
      warehouse: testWarehouse._id,
      description: 'Test Zone Description',
      active: true,
      company: testCompany._id
    });

    testLocation = await LocationModel.create({
      code: 'LOC001',
      name: 'Test Location',
      zone: testZone._id,
      description: 'Test Location Description',
      active: true,
      company: testCompany._id
    });

    testAisle = await AisleModel.create({
      code: 'AISLE001',
      name: 'Test Aisle',
      location: testLocation._id,
      description: 'Test Aisle Description',
      active: true,
      company: testCompany._id
    });

    testRack = await RackModel.create({
      code: 'RACK001',
      name: 'Test Rack',
      aisle: testAisle._id,
      description: 'Test Rack Description',
      active: true,
      company: testCompany._id
    });

    testShelf = await ShelfModel.create({
      code: 'SHELF001',
      name: 'Test Shelf',
      rack: testRack._id,
      description: 'Test Shelf Description',
      active: true,
      company: testCompany._id
    });

    testBin = await BinModel.create({
      code: 'BIN001',
      name: 'Test Bin',
      shelf: testShelf._id,
      description: 'Test Bin Description',
      active: true,
      company: testCompany._id
    });

    // Create GL accounts
    testAssetAccount = await AccountModel.create({
      accountCode: 'ASSET001',
      accountName: 'Inventory Asset',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      isLeaf: true,
      allowManualPost: true,
      currency: 'INR'
    });

    testRevenueAccount = await AccountModel.create({
      accountCode: 'REV001',
      accountName: 'Sales Revenue',
      type: 'REVENUE',
      normalBalance: 'CREDIT',
      isLeaf: true,
      allowManualPost: true,
      currency: 'INR'
    });

    testExpenseAccount = await AccountModel.create({
      accountCode: 'EXP001',
      accountName: 'Cost of Goods Sold',
      type: 'EXPENSE',
      normalBalance: 'DEBIT',
      isLeaf: true,
      allowManualPost: true,
      currency: 'INR'
    });
  });

  afterAll(async () => {
    // Clean up test data
    await SalesOrderModel.deleteMany({});
    await PurchaseOrderModel.deleteMany({});
    await AccountModel.deleteMany({});
    await BinModel.deleteMany({});
    await ShelfModel.deleteMany({});
    await RackModel.deleteMany({});
    await AisleModel.deleteMany({});
    await LocationModel.deleteMany({});
    await ZoneModel.deleteMany({});
    await WarehouseModel.deleteMany({});
    await SiteModel.deleteMany({});
    await ItemModel.deleteMany({});
    await CustomerModel.deleteMany({});
    await VendorModel.deleteMany({});
    await CompanyModel.deleteMany({});
  });

  describe('Complete Purchase to Sales Workflow', () => {
    let purchaseOrder;
    let salesOrder;

    it('should complete the full purchase to sales workflow', async () => {
      // Step 1: Create Purchase Order
      const purchaseOrderData = {
        vendor: testVendor._id,
        item: testItem._id,
        quantity: 100,
        price: 80.00, // Cost price
        currency: 'INR',
        paymentTerms: 'Net30D'
      };

      const purchaseResponse = await request(app)
        .post('/fms/api/v0/purchaseorders')
        .send(purchaseOrderData)
        .expect(201);

      expect(purchaseResponse.body.status).toBe('success');
      purchaseOrder = purchaseResponse.body.data;

      // Step 2: Confirm Purchase Order
      const confirmPurchaseResponse = await request(app)
        .patch(`/fms/api/v0/purchaseorders/${purchaseOrder._id}/status`)
        .send({ newStatus: 'Confirmed' })
        .expect(200);

      expect(confirmPurchaseResponse.body.status).toBe('success');
      expect(confirmPurchaseResponse.body.data.status).toBe('Confirmed');

      // Step 3: Invoice Purchase Order
      const invoicePurchaseResponse = await request(app)
        .patch(`/fms/api/v0/purchaseorders/${purchaseOrder._id}/status`)
        .send({ newStatus: 'Invoiced' })
        .expect(200);

      expect(invoicePurchaseResponse.body.status).toBe('success');
      expect(invoicePurchaseResponse.body.data.status).toBe('Invoiced');

      // Step 4: Create Sales Order
      const salesOrderData = {
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 50,
        price: 100.00, // Selling price
        currency: 'INR',
        paymentTerms: 'Net30D'
      };

      const salesResponse = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(salesOrderData)
        .expect(201);

      expect(salesResponse.body.status).toBe('success');
      salesOrder = salesResponse.body.data;

      // Step 5: Confirm Sales Order
      const confirmSalesResponse = await request(app)
        .patch(`/fms/api/v0/salesorders/${salesOrder._id}/status`)
        .send({ newStatus: 'Confirmed' })
        .expect(200);

      expect(confirmSalesResponse.body.status).toBe('success');
      expect(confirmSalesResponse.body.data.status).toBe('Confirmed');

      // Step 6: Invoice Sales Order
      const invoiceSalesResponse = await request(app)
        .patch(`/fms/api/v0/salesorders/${salesOrder._id}/status`)
        .send({ newStatus: 'Invoiced' })
        .expect(200);

      expect(invoiceSalesResponse.body.status).toBe('success');
      expect(invoiceSalesResponse.body.data.status).toBe('Invoiced');

      // Step 7: Add Payment to Sales Order
      const paymentData = {
        amount: 5000.00, // 50 * 100
        transactionId: 'TXN123',
        paymentMode: 'Cash',
        date: new Date()
      };

      const paymentResponse = await request(app)
        .post(`/fms/api/v0/salesorders/${salesOrder._id}/payment`)
        .send(paymentData)
        .expect(200);

      expect(paymentResponse.body.paidAmt).toBeDefined();
      expect(paymentResponse.body.paidAmt.length).toBe(1);
      expect(paymentResponse.body.paidAmt[0].amount).toBe(5000.00);

      // Step 8: Add Payment to Purchase Order
      const purchasePaymentData = {
        amount: 8000.00, // 100 * 80
        transactionId: 'TXN124',
        paymentMode: 'Bank Transfer',
        date: new Date()
      };

      const purchasePaymentResponse = await request(app)
        .post(`/fms/api/v0/purchaseorders/${purchaseOrder._id}/payment`)
        .send(purchasePaymentData)
        .expect(200);

      expect(purchasePaymentResponse.body.paidAmt).toBeDefined();
      expect(purchasePaymentResponse.body.paidAmt.length).toBe(1);
      expect(purchasePaymentResponse.body.paidAmt[0].amount).toBe(8000.00);
    });

    it('should verify inventory levels after transactions', async () => {
      // This would typically check stock balance
      // For now, we'll verify the orders exist and have correct quantities
      
      const salesOrderResponse = await request(app)
        .get(`/fms/api/v0/salesorders/${salesOrder._id}`)
        .expect(200);

      expect(salesOrderResponse.body.data.quantity).toBe(50);

      const purchaseOrderResponse = await request(app)
        .get(`/fms/api/v0/purchaseorders/${purchaseOrder._id}`)
        .expect(200);

      expect(purchaseOrderResponse.body.data.quantity).toBe(100);
    });

    it('should verify financial reports', async () => {
      // Test trial balance
      const trialBalanceResponse = await request(app)
        .get('/fms/api/v0/accounts/trial-balance')
        .expect(200);

      expect(trialBalanceResponse.body.status).toBe('success');
      expect(trialBalanceResponse.body.data).toBeDefined();

      // Test income statement
      const incomeStatementResponse = await request(app)
        .get('/fms/api/v0/accounts/income-statement')
        .expect(200);

      expect(incomeStatementResponse.body.status).toBe('success');
      expect(incomeStatementResponse.body.data).toBeDefined();

      // Test balance sheet
      const balanceSheetResponse = await request(app)
        .get('/fms/api/v0/accounts/balance-sheet')
        .expect(200);

      expect(balanceSheetResponse.body.status).toBe('success');
      expect(balanceSheetResponse.body.data).toBeDefined();
    });
  });

  describe('Inventory Management Workflow', () => {
    it('should manage complete inventory hierarchy', async () => {
      // Test creating a complete inventory hierarchy
      const hierarchyData = {
        site: testSite._id,
        warehouse: testWarehouse._id,
        zone: testZone._id,
        location: testLocation._id,
        aisle: testAisle._id,
        rack: testRack._id,
        shelf: testShelf._id,
        bin: testBin._id
      };

      // Verify all levels exist
      const siteResponse = await request(app)
        .get(`/fms/api/v0/sites/${testSite._id}`)
        .expect(200);

      expect(siteResponse.body.data.name).toBe('Test Site');

      const warehouseResponse = await request(app)
        .get(`/fms/api/v0/warehouses/${testWarehouse._id}`)
        .expect(200);

      expect(warehouseResponse.body.data.name).toBe('Test Warehouse');

      const zoneResponse = await request(app)
        .get(`/fms/api/v0/zones/${testZone._id}`)
        .expect(200);

      expect(zoneResponse.body.data.name).toBe('Test Zone');

      const locationResponse = await request(app)
        .get(`/fms/api/v0/locations/${testLocation._id}`)
        .expect(200);

      expect(locationResponse.body.data.name).toBe('Test Location');

      const aisleResponse = await request(app)
        .get(`/fms/api/v0/aisles/${testAisle._id}`)
        .expect(200);

      expect(aisleResponse.body.data.name).toBe('Test Aisle');

      const rackResponse = await request(app)
        .get(`/fms/api/v0/racks/${testRack._id}`)
        .expect(200);

      expect(rackResponse.body.data.name).toBe('Test Rack');

      const shelfResponse = await request(app)
        .get(`/fms/api/v0/shelves/${testShelf._id}`)
        .expect(200);

      expect(shelfResponse.body.data.name).toBe('Test Shelf');

      const binResponse = await request(app)
        .get(`/fms/api/v0/bins/${testBin._id}`)
        .expect(200);

      expect(binResponse.body.data.name).toBe('Test Bin');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid status transitions gracefully', async () => {
      // Create a sales order
      const salesOrderData = {
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      };

      const salesResponse = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(salesOrderData)
        .expect(201);

      const salesOrder = salesResponse.body.data;

      // Try invalid status transition
      const invalidStatusResponse = await request(app)
        .patch(`/fms/api/v0/salesorders/${salesOrder._id}/status`)
        .send({ newStatus: 'InvalidStatus' })
        .expect(400);

      expect(invalidStatusResponse.body.status).toBe('failure');
      expect(invalidStatusResponse.body.message).toContain('Invalid status transition');
    });

    it('should handle non-existent resource requests', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/fms/api/v0/salesorders/${nonExistentId}`)
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('not found');
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        // Missing required fields
        quantity: 10
      };

      const response = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(invalidData)
        .expect(422);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('required');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      const numberOfRequests = 10;

      // Create multiple sales orders concurrently
      for (let i = 0; i < numberOfRequests; i++) {
        const salesOrderData = {
          customer: testCustomer._id,
          item: testItem._id,
          quantity: 1,
          price: 100.00,
          currency: 'INR',
          paymentTerms: 'Net30D'
        };

        promises.push(
          request(app)
            .post('/fms/api/v0/salesorders')
            .send(salesOrderData)
        );
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
      });
    });

    it('should handle bulk operations efficiently', async () => {
      // Test bulk account creation
      const accountsData = {
        data: Array.from({ length: 5 }, (_, i) => ({
          accountCode: `BULK${i + 1}`,
          accountName: `Bulk Account ${i + 1}`,
          type: 'ASSET',
          normalBalance: 'DEBIT',
          isLeaf: true,
          allowManualPost: true,
          currency: 'INR'
        }))
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts/bulk')
        .send(accountsData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(5);
    });
  });
});