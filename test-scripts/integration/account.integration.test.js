/**
 * General Ledger Account Integration Tests
 * Tests the complete account functionality end-to-end
 */

import request from 'supertest';
import app from '../../index.js';
import { AccountModel } from '../../models/account.model.js';
import { CompanyModel } from '../../models/company.model.js';
import { GlobalPartyModel } from '../../shared_service/models/globalParty.model.js';

describe('General Ledger Account Integration Tests', () => {
  let testCompany;
  let testGlobalParty;

  beforeEach(async () => {
    // Create test company
    testCompany = await CompanyModel.create({
      name: 'Test Company',
      code: 'TC001',
      address: 'Test Address',
      active: true
    });

    // Create test global party
    testGlobalParty = await GlobalPartyModel.create({
      name: 'Test Party',
      partyType: ['Account'],
      active: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    await AccountModel.deleteMany({});
    await GlobalPartyModel.deleteMany({});
    await CompanyModel.deleteMany({});
  });

  describe('POST /fms/api/v0/accounts', () => {
    it('should create a new account with valid data', async () => {
      const accountData = {
        accountCode: 'ACC001',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR',
        description: 'Test Account Description',
        group: 'Test Group'
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts')
        .send(accountData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.accountCode).toBe('ACC001');
      expect(response.body.data.accountName).toBe('Test Account');
      expect(response.body.data.type).toBe('ASSET');
      expect(response.body.data.normalBalance).toBe('DEBIT');
      expect(response.body.data.sysCode).toBeDefined();
    });

    it('should create account with global party', async () => {
      const accountData = {
        accountCode: 'ACC002',
        accountName: 'Test Account with Party',
        type: 'LIABILITY',
        normalBalance: 'CREDIT',
        globalPartyId: testGlobalParty._id,
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts')
        .send(accountData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.globalPartyId).toBe(testGlobalParty._id.toString());
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        accountName: 'Test Account'
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts')
        .send(invalidData)
        .expect(400);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('required');
    });

    it('should return 404 for non-existent global party', async () => {
      const accountData = {
        accountCode: 'ACC003',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        globalPartyId: '507f1f77bcf86cd799439011', // Non-existent ObjectId
        isLeaf: true,
        allowManualPost: true
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts')
        .send(accountData)
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /fms/api/v0/accounts', () => {
    beforeEach(async () => {
      // Create test accounts
      await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account 1',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });

      await AccountModel.create({
        accountCode: 'ACC002',
        accountName: 'Test Account 2',
        type: 'LIABILITY',
        normalBalance: 'CREDIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should get all accounts', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
    });

    it('should get accounts with hierarchy', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts?hierarchy=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should get accounts including archived', async () => {
      // Archive one account
      await AccountModel.findOneAndUpdate(
        { accountCode: 'ACC001' },
        { isArchived: true }
      );

      const response = await request(app)
        .get('/fms/api/v0/accounts?includeArchived=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('GET /fms/api/v0/accounts/:id', () => {
    let testAccount;

    beforeEach(async () => {
      testAccount = await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should get account by ID', async () => {
      const response = await request(app)
        .get(`/fms/api/v0/accounts/${testAccount._id}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data._id).toBe(testAccount._id.toString());
      expect(response.body.data.accountCode).toBe('ACC001');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts/invalid-id')
        .expect(400);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('Invalid ID');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PATCH /fms/api/v0/accounts/:id', () => {
    let testAccount;

    beforeEach(async () => {
      testAccount = await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should update account', async () => {
      const updateData = {
        accountName: 'Updated Test Account',
        description: 'Updated description'
      };

      const response = await request(app)
        .patch(`/fms/api/v0/accounts/${testAccount._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.accountName).toBe('Updated Test Account');
      expect(response.body.data.description).toBe('Updated description');
    });

    it('should return 400 for no valid fields to update', async () => {
      const updateData = {
        invalidField: 'value'
      };

      const response = await request(app)
        .patch(`/fms/api/v0/accounts/${testAccount._id}`)
        .send(updateData)
        .expect(400);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('No valid fields');
    });
  });

  describe('POST /fms/api/v0/accounts/bulk', () => {
    it('should create multiple accounts', async () => {
      const accountsData = {
        data: [
          {
            accountCode: 'ACC001',
            accountName: 'Test Account 1',
            type: 'ASSET',
            normalBalance: 'DEBIT',
            isLeaf: true,
            allowManualPost: true,
            currency: 'INR'
          },
          {
            accountCode: 'ACC002',
            accountName: 'Test Account 2',
            type: 'LIABILITY',
            normalBalance: 'CREDIT',
            isLeaf: true,
            allowManualPost: true,
            currency: 'INR'
          }
        ]
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts/bulk')
        .send(accountsData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
    });

    it('should return 400 for empty data array', async () => {
      const accountsData = {
        data: []
      };

      const response = await request(app)
        .post('/fms/api/v0/accounts/bulk')
        .send(accountsData)
        .expect(400);

      expect(response.body.status).toBe('failure');
      expect(response.body.message).toContain('non-empty');
    });
  });

  describe('PATCH /fms/api/v0/accounts/bulk', () => {
    let testAccount1, testAccount2;

    beforeEach(async () => {
      testAccount1 = await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account 1',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });

      testAccount2 = await AccountModel.create({
        accountCode: 'ACC002',
        accountName: 'Test Account 2',
        type: 'LIABILITY',
        normalBalance: 'CREDIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should update multiple accounts', async () => {
      const updateData = {
        data: [
          {
            _id: testAccount1._id,
            accountName: 'Updated Account 1'
          },
          {
            _id: testAccount2._id,
            accountName: 'Updated Account 2'
          }
        ]
      };

      const response = await request(app)
        .patch('/fms/api/v0/accounts/bulk')
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('DELETE /fms/api/v0/accounts/:id', () => {
    let testAccount;

    beforeEach(async () => {
      testAccount = await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should delete account', async () => {
      const response = await request(app)
        .delete(`/fms/api/v0/accounts/${testAccount._id}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('PATCH /fms/api/v0/accounts/:id/archive', () => {
    let testAccount;

    beforeEach(async () => {
      testAccount = await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should archive account', async () => {
      const response = await request(app)
        .patch(`/fms/api/v0/accounts/${testAccount._id}/archive`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.isArchived).toBe(true);
    });
  });

  describe('PATCH /fms/api/v0/accounts/:id/unarchive', () => {
    let testAccount;

    beforeEach(async () => {
      testAccount = await AccountModel.create({
        accountCode: 'ACC001',
        accountName: 'Test Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR',
        isArchived: true
      });
    });

    it('should unarchive account', async () => {
      const response = await request(app)
        .patch(`/fms/api/v0/accounts/${testAccount._id}/unarchive`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.isArchived).toBe(false);
    });
  });

  describe('Financial Reports', () => {
    beforeEach(async () => {
      // Create test accounts for financial reports
      await AccountModel.create({
        accountCode: 'ASSET001',
        accountName: 'Cash Account',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });

      await AccountModel.create({
        accountCode: 'REV001',
        accountName: 'Sales Revenue',
        type: 'REVENUE',
        normalBalance: 'CREDIT',
        isLeaf: true,
        allowManualPost: true,
        currency: 'INR'
      });
    });

    it('should get trial balance', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts/trial-balance')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
    });

    it('should get income statement', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts/income-statement')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
    });

    it('should get balance sheet', async () => {
      const response = await request(app)
        .get('/fms/api/v0/accounts/balance-sheet')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
    });
  });
});