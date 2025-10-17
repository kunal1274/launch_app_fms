/**
 * Test Data Factory
 * Creates consistent test data for all modules
 */

import mongoose from 'mongoose';
import { CompanyModel } from '../../models/company.model.js';
import { CustomerModel } from '../../models/customer.model.js';
import { VendorModel } from '../../models/vendor.model.js';
import { ItemModel } from '../../models/item.model.js';
import { AccountModel } from '../../models/account.model.js';
import { SiteModel } from '../../models/site.model.js';
import { WarehouseModel } from '../../models/warehouse.model.js';
import { ZoneModel } from '../../models/zone.model.js';
import { LocationModel } from '../../models/location.model.js';
import { AisleModel } from '../../models/aisle.model.js';
import { RackModel } from '../../models/rack.model.js';
import { ShelfModel } from '../../models/shelf.model.js';
import { BinModel } from '../../models/bin.model.js';
import { GlobalPartyModel } from '../../shared_service/models/globalParty.model.js';

export class TestDataFactory {
  static async createCompany(overrides = {}) {
    const defaultData = {
      name: 'Test Company',
      code: 'TC001',
      address: 'Test Address',
      active: true,
      ...overrides
    };

    return await CompanyModel.create(defaultData);
  }

  static async createCustomer(companyId, overrides = {}) {
    const defaultData = {
      name: 'Test Customer',
      email: 'test@customer.com',
      contactNum: '1234567890',
      address: 'Test Customer Address',
      company: companyId,
      active: true,
      ...overrides
    };

    return await CustomerModel.create(defaultData);
  }

  static async createVendor(companyId, overrides = {}) {
    const defaultData = {
      name: 'Test Vendor',
      email: 'test@vendor.com',
      contactNum: '1234567890',
      address: 'Test Vendor Address',
      company: companyId,
      active: true,
      ...overrides
    };

    return await VendorModel.create(defaultData);
  }

  static async createItem(overrides = {}) {
    const defaultData = {
      name: 'Test Item',
      description: 'Test Item Description',
      type: 'Goods',
      unit: 'PCS',
      price: 100.00,
      costPrice: 80.00,
      active: true,
      ...overrides
    };

    return await ItemModel.create(defaultData);
  }

  static async createAccount(overrides = {}) {
    const defaultData = {
      accountCode: 'ACC001',
      accountName: 'Test Account',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      isLeaf: true,
      allowManualPost: true,
      currency: 'INR',
      ...overrides
    };

    return await AccountModel.create(defaultData);
  }

  static async createGlobalParty(overrides = {}) {
    const defaultData = {
      name: 'Test Party',
      partyType: ['Account'],
      active: true,
      ...overrides
    };

    return await GlobalPartyModel.create(defaultData);
  }

  static async createInventoryHierarchy(companyId) {
    const site = await this.createSite(companyId);
    const warehouse = await this.createWarehouse(site._id, companyId);
    const zone = await this.createZone(warehouse._id, companyId);
    const location = await this.createLocation(zone._id, companyId);
    const aisle = await this.createAisle(location._id, companyId);
    const rack = await this.createRack(aisle._id, companyId);
    const shelf = await this.createShelf(rack._id, companyId);
    const bin = await this.createBin(shelf._id, companyId);

    return {
      site,
      warehouse,
      zone,
      location,
      aisle,
      rack,
      shelf,
      bin
    };
  }

  static async createSite(companyId, overrides = {}) {
    const defaultData = {
      code: 'SITE001',
      name: 'Test Site',
      description: 'Test Site Description',
      address: 'Test Site Address',
      active: true,
      company: companyId,
      ...overrides
    };

    return await SiteModel.create(defaultData);
  }

  static async createWarehouse(siteId, companyId, overrides = {}) {
    const defaultData = {
      code: 'WH001',
      name: 'Test Warehouse',
      site: siteId,
      address: 'Test Warehouse Address',
      active: true,
      company: companyId,
      ...overrides
    };

    return await WarehouseModel.create(defaultData);
  }

  static async createZone(warehouseId, companyId, overrides = {}) {
    const defaultData = {
      code: 'ZONE001',
      name: 'Test Zone',
      warehouse: warehouseId,
      description: 'Test Zone Description',
      active: true,
      company: companyId,
      ...overrides
    };

    return await ZoneModel.create(defaultData);
  }

  static async createLocation(zoneId, companyId, overrides = {}) {
    const defaultData = {
      code: 'LOC001',
      name: 'Test Location',
      zone: zoneId,
      description: 'Test Location Description',
      active: true,
      company: companyId,
      ...overrides
    };

    return await LocationModel.create(defaultData);
  }

  static async createAisle(locationId, companyId, overrides = {}) {
    const defaultData = {
      code: 'AISLE001',
      name: 'Test Aisle',
      location: locationId,
      description: 'Test Aisle Description',
      active: true,
      company: companyId,
      ...overrides
    };

    return await AisleModel.create(defaultData);
  }

  static async createRack(aisleId, companyId, overrides = {}) {
    const defaultData = {
      code: 'RACK001',
      name: 'Test Rack',
      aisle: aisleId,
      description: 'Test Rack Description',
      active: true,
      company: companyId,
      ...overrides
    };

    return await RackModel.create(defaultData);
  }

  static async createShelf(rackId, companyId, overrides = {}) {
    const defaultData = {
      code: 'SHELF001',
      name: 'Test Shelf',
      rack: rackId,
      description: 'Test Shelf Description',
      active: true,
      company: companyId,
      ...overrides
    };

    return await ShelfModel.create(defaultData);
  }

  static async createBin(shelfId, companyId, overrides = {}) {
    const defaultData = {
      code: 'BIN001',
      name: 'Test Bin',
      shelf: shelfId,
      description: 'Test Bin Description',
      active: true,
      company: companyId,
      ...overrides
    };

    return await BinModel.create(defaultData);
  }

  static async createSalesOrderData(customerId, itemId, overrides = {}) {
    return {
      customer: customerId,
      item: itemId,
      quantity: 10,
      price: 100.00,
      currency: 'INR',
      paymentTerms: 'Net30D',
      ...overrides
    };
  }

  static async createPurchaseOrderData(vendorId, itemId, overrides = {}) {
    return {
      vendor: vendorId,
      item: itemId,
      quantity: 10,
      price: 80.00,
      currency: 'INR',
      paymentTerms: 'Net30D',
      ...overrides
    };
  }

  static async createPaymentData(overrides = {}) {
    return {
      amount: 100.00,
      transactionId: 'TXN123',
      paymentMode: 'Cash',
      date: new Date(),
      ...overrides
    };
  }

  static async createBulkData(count, factoryMethod, ...args) {
    const data = [];
    for (let i = 0; i < count; i++) {
      const item = await factoryMethod(...args, { 
        name: `Test Item ${i + 1}`,
        code: `CODE${(i + 1).toString().padStart(3, '0')}`
      });
      data.push(item);
    }
    return data;
  }

  static async cleanupTestData() {
    const models = [
      BinModel, ShelfModel, RackModel, AisleModel, LocationModel,
      ZoneModel, WarehouseModel, SiteModel, AccountModel, ItemModel,
      CustomerModel, VendorModel, CompanyModel, GlobalPartyModel
    ];

    for (const model of models) {
      await model.deleteMany({});
    }
  }

  static generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateRandomEmail() {
    return `test.${this.generateRandomString(8)}@example.com`;
  }

  static generateRandomPhone() {
    return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  }

  static generateRandomAmount(min = 10, max = 1000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static generateRandomDate(start = new Date('2020-01-01'), end = new Date()) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}