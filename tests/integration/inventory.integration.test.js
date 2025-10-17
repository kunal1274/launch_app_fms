/**
 * Inventory Management Integration Tests
 * Tests the complete inventory functionality end-to-end
 */

import request from 'supertest';
import app from '../../index.js';
import { ItemModel } from '../../models/item.model.js';
import { CompanyModel } from '../../models/company.model.js';
import { SiteModel } from '../../models/site.model.js';
import { WarehouseModel } from '../../models/warehouse.model.js';
import { ZoneModel } from '../../models/zone.model.js';
import { LocationModel } from '../../models/location.model.js';
import { AisleModel } from '../../models/aisle.model.js';
import { RackModel } from '../../models/rack.model.js';
import { ShelfModel } from '../../models/shelf.model.js';
import { BinModel } from '../../models/bin.model.js';

describe('Inventory Management Integration Tests', () => {
  let testCompany;
  let testSite;
  let testWarehouse;
  let testZone;
  let testLocation;
  let testAisle;
  let testRack;
  let testShelf;
  let testBin;

  beforeEach(async () => {
    // Create test company
    testCompany = await CompanyModel.create({
      name: 'Test Company',
      code: 'TC001',
      address: 'Test Address',
      active: true
    });

    // Create test site
    testSite = await SiteModel.create({
      code: 'SITE001',
      name: 'Test Site',
      description: 'Test Site Description',
      address: 'Test Site Address',
      active: true,
      company: testCompany._id
    });

    // Create test warehouse
    testWarehouse = await WarehouseModel.create({
      code: 'WH001',
      name: 'Test Warehouse',
      site: testSite._id,
      address: 'Test Warehouse Address',
      active: true,
      company: testCompany._id
    });

    // Create test zone
    testZone = await ZoneModel.create({
      code: 'ZONE001',
      name: 'Test Zone',
      warehouse: testWarehouse._id,
      description: 'Test Zone Description',
      active: true,
      company: testCompany._id
    });

    // Create test location
    testLocation = await LocationModel.create({
      code: 'LOC001',
      name: 'Test Location',
      zone: testZone._id,
      description: 'Test Location Description',
      active: true,
      company: testCompany._id
    });

    // Create test aisle
    testAisle = await AisleModel.create({
      code: 'AISLE001',
      name: 'Test Aisle',
      location: testLocation._id,
      description: 'Test Aisle Description',
      active: true,
      company: testCompany._id
    });

    // Create test rack
    testRack = await RackModel.create({
      code: 'RACK001',
      name: 'Test Rack',
      aisle: testAisle._id,
      description: 'Test Rack Description',
      active: true,
      company: testCompany._id
    });

    // Create test shelf
    testShelf = await ShelfModel.create({
      code: 'SHELF001',
      name: 'Test Shelf',
      rack: testRack._id,
      description: 'Test Shelf Description',
      active: true,
      company: testCompany._id
    });

    // Create test bin
    testBin = await BinModel.create({
      code: 'BIN001',
      name: 'Test Bin',
      shelf: testShelf._id,
      description: 'Test Bin Description',
      active: true,
      company: testCompany._id
    });
  });

  afterEach(async () => {
    // Clean up test data
    await ItemModel.deleteMany({});
    await BinModel.deleteMany({});
    await ShelfModel.deleteMany({});
    await RackModel.deleteMany({});
    await AisleModel.deleteMany({});
    await LocationModel.deleteMany({});
    await ZoneModel.deleteMany({});
    await WarehouseModel.deleteMany({});
    await SiteModel.deleteMany({});
    await CompanyModel.deleteMany({});
  });

  describe('Item Management', () => {
    describe('POST /fms/api/v0/items', () => {
      it('should create a new item with valid data', async () => {
        const itemData = {
          name: 'Test Item',
          description: 'Test Item Description',
          type: 'Goods',
          unit: 'PCS',
          price: 100.00,
          active: true
        };

        const response = await request(app)
          .post('/fms/api/v0/items')
          .send(itemData)
          .expect(201);

        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeDefined();
        expect(response.body.data.name).toBe('Test Item');
        expect(response.body.data.type).toBe('Goods');
        expect(response.body.data.itemNum).toBeDefined();
      });

      it('should return 400 for missing required fields', async () => {
        const invalidData = {
          description: 'Test Item Description'
        };

        const response = await request(app)
          .post('/fms/api/v0/items')
          .send(invalidData)
          .expect(400);

        expect(response.body.status).toBe('failure');
      });
    });

    describe('GET /fms/api/v0/items', () => {
      beforeEach(async () => {
        // Create test items
        await ItemModel.create({
          name: 'Test Item 1',
          description: 'Test Item 1 Description',
          type: 'Goods',
          unit: 'PCS',
          price: 100.00,
          active: true
        });

        await ItemModel.create({
          name: 'Test Item 2',
          description: 'Test Item 2 Description',
          type: 'Services',
          unit: 'HRS',
          price: 50.00,
          active: true
        });
      });

      it('should get all items', async () => {
        const response = await request(app)
          .get('/fms/api/v0/items')
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBe(2);
      });
    });
  });

  describe('Storage Dimensions', () => {
    describe('Site Management', () => {
      describe('POST /fms/api/v0/sites', () => {
        it('should create a new site', async () => {
          const siteData = {
            code: 'SITE002',
            name: 'Test Site 2',
            description: 'Test Site 2 Description',
            address: 'Test Site 2 Address',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/sites')
            .send(siteData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Site 2');
        });
      });

      describe('GET /fms/api/v0/sites', () => {
        it('should get all sites', async () => {
          const response = await request(app)
            .get('/fms/api/v0/sites')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Warehouse Management', () => {
      describe('POST /fms/api/v0/warehouses', () => {
        it('should create a new warehouse', async () => {
          const warehouseData = {
            code: 'WH002',
            name: 'Test Warehouse 2',
            site: testSite._id,
            address: 'Test Warehouse 2 Address',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/warehouses')
            .send(warehouseData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Warehouse 2');
        });
      });

      describe('GET /fms/api/v0/warehouses', () => {
        it('should get all warehouses', async () => {
          const response = await request(app)
            .get('/fms/api/v0/warehouses')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Zone Management', () => {
      describe('POST /fms/api/v0/zones', () => {
        it('should create a new zone', async () => {
          const zoneData = {
            code: 'ZONE002',
            name: 'Test Zone 2',
            warehouse: testWarehouse._id,
            description: 'Test Zone 2 Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/zones')
            .send(zoneData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Zone 2');
        });
      });

      describe('GET /fms/api/v0/zones', () => {
        it('should get all zones', async () => {
          const response = await request(app)
            .get('/fms/api/v0/zones')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Location Management', () => {
      describe('POST /fms/api/v0/locations', () => {
        it('should create a new location', async () => {
          const locationData = {
            code: 'LOC002',
            name: 'Test Location 2',
            zone: testZone._id,
            description: 'Test Location 2 Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/locations')
            .send(locationData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Location 2');
        });
      });

      describe('GET /fms/api/v0/locations', () => {
        it('should get all locations', async () => {
          const response = await request(app)
            .get('/fms/api/v0/locations')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Aisle Management', () => {
      describe('POST /fms/api/v0/aisles', () => {
        it('should create a new aisle', async () => {
          const aisleData = {
            code: 'AISLE002',
            name: 'Test Aisle 2',
            location: testLocation._id,
            description: 'Test Aisle 2 Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/aisles')
            .send(aisleData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Aisle 2');
        });
      });

      describe('GET /fms/api/v0/aisles', () => {
        it('should get all aisles', async () => {
          const response = await request(app)
            .get('/fms/api/v0/aisles')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Rack Management', () => {
      describe('POST /fms/api/v0/racks', () => {
        it('should create a new rack', async () => {
          const rackData = {
            code: 'RACK002',
            name: 'Test Rack 2',
            aisle: testAisle._id,
            description: 'Test Rack 2 Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/racks')
            .send(rackData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Rack 2');
        });
      });

      describe('GET /fms/api/v0/racks', () => {
        it('should get all racks', async () => {
          const response = await request(app)
            .get('/fms/api/v0/racks')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Shelf Management', () => {
      describe('POST /fms/api/v0/shelves', () => {
        it('should create a new shelf', async () => {
          const shelfData = {
            code: 'SHELF002',
            name: 'Test Shelf 2',
            rack: testRack._id,
            description: 'Test Shelf 2 Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/shelves')
            .send(shelfData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Shelf 2');
        });
      });

      describe('GET /fms/api/v0/shelves', () => {
        it('should get all shelves', async () => {
          const response = await request(app)
            .get('/fms/api/v0/shelves')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });

    describe('Bin Management', () => {
      describe('POST /fms/api/v0/bins', () => {
        it('should create a new bin', async () => {
          const binData = {
            code: 'BIN002',
            name: 'Test Bin 2',
            shelf: testShelf._id,
            description: 'Test Bin 2 Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/bins')
            .send(binData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Bin 2');
        });
      });

      describe('GET /fms/api/v0/bins', () => {
        it('should get all bins', async () => {
          const response = await request(app)
            .get('/fms/api/v0/bins')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
          expect(response.body.data.length).toBe(1);
        });
      });
    });
  });

  describe('Product Dimensions', () => {
    describe('Configuration Management', () => {
      describe('POST /fms/api/v0/configurations', () => {
        it('should create a new configuration', async () => {
          const configData = {
            code: 'CONFIG001',
            name: 'Test Configuration',
            description: 'Test Configuration Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/configurations')
            .send(configData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Configuration');
        });
      });

      describe('GET /fms/api/v0/configurations', () => {
        it('should get all configurations', async () => {
          const response = await request(app)
            .get('/fms/api/v0/configurations')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });

    describe('Color Management', () => {
      describe('POST /fms/api/v0/colors', () => {
        it('should create a new color', async () => {
          const colorData = {
            code: 'COLOR001',
            name: 'Test Color',
            hexCode: '#FF0000',
            description: 'Test Color Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/colors')
            .send(colorData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Color');
        });
      });

      describe('GET /fms/api/v0/colors', () => {
        it('should get all colors', async () => {
          const response = await request(app)
            .get('/fms/api/v0/colors')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });

    describe('Size Management', () => {
      describe('POST /fms/api/v0/sizes', () => {
        it('should create a new size', async () => {
          const sizeData = {
            code: 'SIZE001',
            name: 'Test Size',
            description: 'Test Size Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/sizes')
            .send(sizeData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Size');
        });
      });

      describe('GET /fms/api/v0/sizes', () => {
        it('should get all sizes', async () => {
          const response = await request(app)
            .get('/fms/api/v0/sizes')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });

    describe('Style Management', () => {
      describe('POST /fms/api/v0/styles', () => {
        it('should create a new style', async () => {
          const styleData = {
            code: 'STYLE001',
            name: 'Test Style',
            description: 'Test Style Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/styles')
            .send(styleData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Style');
        });
      });

      describe('GET /fms/api/v0/styles', () => {
        it('should get all styles', async () => {
          const response = await request(app)
            .get('/fms/api/v0/styles')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });

    describe('Version Management', () => {
      describe('POST /fms/api/v0/versions', () => {
        it('should create a new version', async () => {
          const versionData = {
            code: 'VERSION001',
            name: 'Test Version',
            description: 'Test Version Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/versions')
            .send(versionData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Version');
        });
      });

      describe('GET /fms/api/v0/versions', () => {
        it('should get all versions', async () => {
          const response = await request(app)
            .get('/fms/api/v0/versions')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });
  });

  describe('Tracking Dimensions', () => {
    describe('Batch Management', () => {
      describe('POST /fms/api/v0/batches', () => {
        it('should create a new batch', async () => {
          const batchData = {
            code: 'BATCH001',
            name: 'Test Batch',
            description: 'Test Batch Description',
            expiryDate: new Date('2024-12-31'),
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/batches')
            .send(batchData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Batch');
        });
      });

      describe('GET /fms/api/v0/batches', () => {
        it('should get all batches', async () => {
          const response = await request(app)
            .get('/fms/api/v0/batches')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });

    describe('Serial Management', () => {
      describe('POST /fms/api/v0/serials', () => {
        it('should create a new serial', async () => {
          const serialData = {
            code: 'SERIAL001',
            name: 'Test Serial',
            description: 'Test Serial Description',
            active: true,
            company: testCompany._id
          };

          const response = await request(app)
            .post('/fms/api/v0/serials')
            .send(serialData)
            .expect(201);

          expect(response.body.status).toBe('success');
          expect(response.body.data.name).toBe('Test Serial');
        });
      });

      describe('GET /fms/api/v0/serials', () => {
        it('should get all serials', async () => {
          const response = await request(app)
            .get('/fms/api/v0/serials')
            .expect(200);

          expect(response.body.status).toBe('success');
          expect(response.body.data).toBeInstanceOf(Array);
        });
      });
    });
  });
});