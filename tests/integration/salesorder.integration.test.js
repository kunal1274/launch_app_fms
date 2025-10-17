/**
 * Sales Order Integration Tests
 * Tests the complete sales order functionality end-to-end
 */

import request from 'supertest';
import app from '../../index.js';
import { SalesOrderModel } from '../../models/salesorder.model.js';
import { CustomerModel } from '../../models/customer.model.js';
import { ItemModel } from '../../models/item.model.js';
import { CompanyModel } from '../../models/company.model.js';

describe('Sales Order Integration Tests', () => {
  let testCustomer;
  let testItem;
  let testCompany;
  let testSalesOrder;

  beforeEach(async () => {
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

    // Create test item
    testItem = await ItemModel.create({
      name: 'Test Item',
      description: 'Test Item Description',
      type: 'Goods',
      unit: 'PCS',
      price: 100.00,
      active: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    await SalesOrderModel.deleteMany({});
    await CustomerModel.deleteMany({});
    await ItemModel.deleteMany({});
    await CompanyModel.deleteMany({});
  });

  describe('POST /fms/api/v0/salesorders', () => {
    it('should create a new sales order with valid data', async () => {
      const salesOrderData = {
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      };

      const response = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(salesOrderData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.customer).toBe(testCustomer._id.toString());
      expect(response.body.data.item).toBe(testItem._id.toString());
      expect(response.body.data.quantity).toBe(10);
      expect(response.body.data.price).toBe(100.00);
      expect(response.body.data.orderNum).toBeDefined();
    });

    it('should return 422 for missing required fields', async () => {
      const invalidData = {
        quantity: 10,
        price: 100.00
      };

      const response = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(invalidData)
        .expect(422);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('Customer and Item are required');
    });

    it('should return 404 for non-existent customer', async () => {
      const salesOrderData = {
        customer: '507f1f77bcf86cd799439011', // Non-existent ObjectId
        item: testItem._id,
        quantity: 10,
        price: 100.00
      };

      const response = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(salesOrderData)
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('does not exist');
    });

    it('should return 404 for non-existent item', async () => {
      const salesOrderData = {
        customer: testCustomer._id,
        item: '507f1f77bcf86cd799439011', // Non-existent ObjectId
        quantity: 10,
        price: 100.00
      };

      const response = await request(app)
        .post('/fms/api/v0/salesorders')
        .send(salesOrderData)
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('does not exist');
    });
  });

  describe('GET /fms/api/v0/salesorders', () => {
    beforeEach(async () => {
      // Create test sales orders
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      });
    });

    it('should get all sales orders', async () => {
      const response = await request(app)
        .get('/fms/api/v0/salesorders')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.count).toBe(1);
    });

    it('should get archived sales orders', async () => {
      // Archive the sales order
      await SalesOrderModel.findByIdAndUpdate(testSalesOrder._id, { archived: true });

      const response = await request(app)
        .get('/fms/api/v0/salesorders/archived')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('GET /fms/api/v0/salesorders/:id', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      });
    });

    it('should get sales order by ID', async () => {
      const response = await request(app)
        .get(`/fms/api/v0/salesorders/${testSalesOrder._id}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data._id).toBe(testSalesOrder._id.toString());
      expect(response.body.data.customer).toBeDefined();
      expect(response.body.data.item).toBeDefined();
    });

    it('should return 404 for non-existent sales order', async () => {
      const response = await request(app)
        .get('/fms/api/v0/salesorders/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PUT /fms/api/v0/salesorders/:id', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      });
    });

    it('should update sales order', async () => {
      const updateData = {
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 20,
        price: 150.00,
        currency: 'USD'
      };

      const response = await request(app)
        .put(`/fms/api/v0/salesorders/${testSalesOrder._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.quantity).toBe(20);
      expect(response.body.data.price).toBe(150.00);
      expect(response.body.data.currency).toBe('USD');
    });

    it('should return 404 for non-existent sales order', async () => {
      const updateData = {
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 20,
        price: 150.00
      };

      const response = await request(app)
        .put('/fms/api/v0/salesorders/507f1f77bcf86cd799439011')
        .send(updateData)
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PATCH /fms/api/v0/salesorders/:id/status', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D',
        status: 'Draft'
      });
    });

    it('should change sales order status to Confirmed', async () => {
      const response = await request(app)
        .patch(`/fms/api/v0/salesorders/${testSalesOrder._id}/status`)
        .send({ newStatus: 'Confirmed' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.status).toBe('Confirmed');
    });

    it('should return 400 for invalid status transition', async () => {
      const response = await request(app)
        .patch(`/fms/api/v0/salesorders/${testSalesOrder._id}/status`)
        .send({ newStatus: 'Invoiced' })
        .expect(400);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('Invalid status transition');
    });
  });

  describe('POST /fms/api/v0/salesorders/:id/payment', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D',
        status: 'Draft'
      });
    });

    it('should add payment to sales order', async () => {
      const paymentData = {
        amount: 50.00,
        transactionId: 'TXN123',
        paymentMode: 'Cash',
        date: new Date()
      };

      const response = await request(app)
        .post(`/fms/api/v0/salesorders/${testSalesOrder._id}/payment`)
        .send(paymentData)
        .expect(200);

      expect(response.body.paidAmt).toBeDefined();
      expect(response.body.paidAmt.length).toBe(1);
      expect(response.body.paidAmt[0].amount).toBe(50.00);
    });

    it('should return 400 for missing payment amount', async () => {
      const paymentData = {
        transactionId: 'TXN123',
        paymentMode: 'Cash'
      };

      const response = await request(app)
        .post(`/fms/api/v0/salesorders/${testSalesOrder._id}/payment`)
        .send(paymentData)
        .expect(400);

      expect(response.body.error).toContain('payment amount is required');
    });
  });

  describe('DELETE /fms/api/v0/salesorders/:id', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      });
    });

    it('should delete sales order', async () => {
      const response = await request(app)
        .delete(`/fms/api/v0/salesorders/${testSalesOrder._id}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 404 for non-existent sales order', async () => {
      const response = await request(app)
        .delete('/fms/api/v0/salesorders/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PATCH /fms/api/v0/salesorders/:id/archive', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D'
      });
    });

    it('should archive sales order', async () => {
      const response = await request(app)
        .patch(`/fms/api/v0/salesorders/${testSalesOrder._id}/archive`)
        .expect(200);

      expect(response.body.archived).toBe(true);
    });
  });

  describe('PATCH /fms/api/v0/salesorders/:id/unarchive', () => {
    beforeEach(async () => {
      testSalesOrder = await SalesOrderModel.create({
        customer: testCustomer._id,
        item: testItem._id,
        quantity: 10,
        price: 100.00,
        currency: 'INR',
        paymentTerms: 'Net30D',
        archived: true
      });
    });

    it('should unarchive sales order', async () => {
      const response = await request(app)
        .patch(`/fms/api/v0/salesorders/${testSalesOrder._id}/unarchive`)
        .expect(200);

      expect(response.body.archived).toBe(false);
    });
  });
});