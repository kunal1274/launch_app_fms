# FMS Integration Guide & Usage Examples

## Overview

This comprehensive guide provides practical examples and integration patterns for the Financial Management System (FMS). It includes real-world usage scenarios, code examples, and best practices for integrating with the FMS APIs and components.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication Integration](#authentication-integration)
3. [API Integration Examples](#api-integration-examples)
4. [Frontend Integration](#frontend-integration)
5. [File Upload Integration](#file-upload-integration)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Real-world Workflows](#real-world-workflows)
8. [Performance Optimization](#performance-optimization)
9. [Testing Strategies](#testing-strategies)

## Getting Started

### Environment Setup

1. **Clone and Install Dependencies**
```bash
git clone <repository-url>
cd fms-backend
npm install
```

2. **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Configure your environment variables
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fms_dev
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

3. **Database Setup**
```bash
# Start MongoDB
mongod

# Run database migrations/seeds (if any)
npm run seed
```

4. **Start the Server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Authentication Integration

### 1. User Registration & Login Flow

#### Backend Implementation
```javascript
// controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserGlobalModel } from '../models/userGlobal.model.js';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;
    
    // Check if user already exists
    const existingUser = await UserGlobalModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'failure',
        message: 'User already exists with this email'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await UserGlobalModel.create({
      name,
      email,
      password: hashedPassword,
      role,
      isActive: true
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'failure',
      message: 'Registration failed',
      error: error.message
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await UserGlobalModel.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        status: 'failure',
        message: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'failure',
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'failure',
      message: 'Login failed',
      error: error.message
    });
  }
};
```

#### Frontend Integration (React)
```jsx
// services/authService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/fms/api/v0';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.setupInterceptors();
  }
  
  setupInterceptors() {
    // Request interceptor to add token
    axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor to handle token expiration
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }
  
  async register(userData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
      if (response.data.data.token) {
        this.setToken(response.data.data.token);
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
  
  async login(email, password) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });
      
      if (response.data.data.token) {
        this.setToken(response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
  
  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }
  
  getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
  }
  
  isAuthenticated() {
    return !!this.token;
  }
}

export const authService = new AuthService();

// components/LoginForm.jsx
import React, { useState } from 'react';
import { authService } from '../services/authService';

const LoginForm = ({ onSuccess }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await authService.login(credentials.email, credentials.password);
      onSuccess();
    } catch (error) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Login to FMS</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-field">
        <label>Email</label>
        <input
          type="email"
          value={credentials.email}
          onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
          required
        />
      </div>
      
      <div className="form-field">
        <label>Password</label>
        <input
          type="password"
          value={credentials.password}
          onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
          required
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

## API Integration Examples

### 1. Customer Management Integration

#### Complete Customer CRUD Operations
```javascript
// services/customerService.js
import axios from 'axios';

class CustomerService {
  constructor() {
    this.baseURL = `${process.env.REACT_APP_API_URL}/customers`;
  }
  
  // Create customer
  async createCustomer(customerData) {
    try {
      const response = await axios.post(this.baseURL, customerData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Get all customers with filters
  async getCustomers(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });
      
      const response = await axios.get(`${this.baseURL}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Get customer by ID
  async getCustomer(customerId) {
    try {
      const response = await axios.get(`${this.baseURL}/${customerId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Update customer
  async updateCustomer(customerId, updateData) {
    try {
      const response = await axios.put(`${this.baseURL}/${customerId}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Delete customer
  async deleteCustomer(customerId) {
    try {
      const response = await axios.delete(`${this.baseURL}/${customerId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Search customers
  async searchCustomers(searchTerm) {
    try {
      const response = await axios.get(`${this.baseURL}?search=${encodeURIComponent(searchTerm)}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  handleError(error) {
    if (error.response) {
      return {
        message: error.response.data.message || 'An error occurred',
        status: error.response.status,
        details: error.response.data.details || null
      };
    }
    return { message: 'Network error', status: 500 };
  }
}

export const customerService = new CustomerService();
```

#### React Hook for Customer Management
```jsx
// hooks/useCustomers.js
import { useState, useEffect } from 'react';
import { customerService } from '../services/customerService';

export const useCustomers = (filters = {}) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  
  const fetchCustomers = async (newFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await customerService.getCustomers({ ...filters, ...newFilters });
      setCustomers(response.data.customers);
      setPagination(response.data.pagination);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const createCustomer = async (customerData) => {
    try {
      const response = await customerService.createCustomer(customerData);
      await fetchCustomers(); // Refresh list
      return response;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };
  
  const updateCustomer = async (customerId, updateData) => {
    try {
      const response = await customerService.updateCustomer(customerId, updateData);
      await fetchCustomers(); // Refresh list
      return response;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };
  
  const deleteCustomer = async (customerId) => {
    try {
      await customerService.deleteCustomer(customerId);
      await fetchCustomers(); // Refresh list
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };
  
  useEffect(() => {
    fetchCustomers();
  }, []);
  
  return {
    customers,
    loading,
    error,
    pagination,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    refetch: fetchCustomers
  };
};

// components/CustomerList.jsx
import React, { useState } from 'react';
import { useCustomers } from '../hooks/useCustomers';
import DataTable from '../components/DataTable';
import CustomerForm from '../components/CustomerForm';

const CustomerList = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [filters, setFilters] = useState({});
  
  const {
    customers,
    loading,
    error,
    pagination,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    fetchCustomers
  } = useCustomers(filters);
  
  const columns = [
    { key: 'code', title: 'Code' },
    { key: 'name', title: 'Name' },
    { key: 'contactNum', title: 'Contact' },
    { key: 'email', title: 'Email' },
    { 
      key: 'businessType', 
      title: 'Business Type',
      render: (value) => <span className={`badge ${value.toLowerCase()}`}>{value}</span>
    },
    { 
      key: 'isActive', 
      title: 'Status',
      render: (value) => (
        <span className={`status-badge ${value ? 'active' : 'inactive'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ];
  
  const handleSubmit = async (customerData) => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer._id, customerData);
      } else {
        await createCustomer(customerData);
      }
      setShowForm(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Failed to save customer:', error);
    }
  };
  
  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };
  
  const handleDelete = async (customer) => {
    if (window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
      try {
        await deleteCustomer(customer._id);
      } catch (error) {
        console.error('Failed to delete customer:', error);
      }
    }
  };
  
  if (error) {
    return <div className="error-container">Error: {error}</div>;
  }
  
  return (
    <div className="customer-list">
      <div className="page-header">
        <h1>Customers</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          Add Customer
        </button>
      </div>
      
      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
        />
      )}
    </div>
  );
};
```

### 2. Sales Order Workflow Integration

#### Complete Sales Order Management
```javascript
// services/salesOrderService.js
class SalesOrderService {
  constructor() {
    this.baseURL = `${process.env.REACT_APP_API_URL}/salesorders`;
  }
  
  async createSalesOrder(orderData) {
    // Calculate totals before sending
    const processedOrder = this.calculateOrderTotals(orderData);
    
    try {
      const response = await axios.post(this.baseURL, processedOrder);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  calculateOrderTotals(orderData) {
    let subTotal = 0;
    
    const processedLines = orderData.salesOrderLines.map(line => {
      const lineTotal = line.quantity * line.unitPrice;
      const discountAmount = (lineTotal * (line.discountPercent || 0)) / 100;
      const finalLineTotal = lineTotal - discountAmount;
      
      subTotal += finalLineTotal;
      
      return {
        ...line,
        lineTotal: finalLineTotal,
        discountAmount
      };
    });
    
    const totalDiscount = processedLines.reduce((sum, line) => sum + (line.discountAmount || 0), 0);
    const taxAmount = (subTotal * (orderData.taxPercent || 0)) / 100;
    const totalAmount = subTotal + taxAmount;
    
    return {
      ...orderData,
      salesOrderLines: processedLines,
      subTotal,
      totalDiscount,
      taxAmount,
      totalAmount
    };
  }
  
  async updateOrderStatus(orderId, status) {
    try {
      const response = await axios.patch(`${this.baseURL}/${orderId}/status`, { status });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async addOrderAttachment(orderId, formData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${orderId}/attachments`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  handleError(error) {
    if (error.response) {
      return {
        message: error.response.data.message || 'An error occurred',
        status: error.response.status,
        details: error.response.data.details || null
      };
    }
    return { message: 'Network error', status: 500 };
  }
}

export const salesOrderService = new SalesOrderService();

// components/SalesOrderForm.jsx
import React, { useState, useEffect } from 'react';
import { customerService } from '../services/customerService';
import { itemService } from '../services/itemService';
import { salesOrderService } from '../services/salesOrderService';

const SalesOrderForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    orderDate: new Date().toISOString().split('T')[0],
    requiredDate: '',
    currency: 'INR',
    paymentTerms: 'Net 30',
    salesOrderLines: [
      {
        itemId: '',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0
      }
    ],
    notes: ''
  });
  
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Load customers and items
    const loadData = async () => {
      try {
        const [customersResponse, itemsResponse] = await Promise.all([
          customerService.getCustomers({ isActive: true }),
          itemService.getItems({ isActive: true })
        ]);
        
        setCustomers(customersResponse.data.customers);
        setItems(itemsResponse.data.items);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadData();
  }, []);
  
  const addOrderLine = () => {
    setFormData(prev => ({
      ...prev,
      salesOrderLines: [
        ...prev.salesOrderLines,
        { itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0 }
      ]
    }));
  };
  
  const removeOrderLine = (index) => {
    setFormData(prev => ({
      ...prev,
      salesOrderLines: prev.salesOrderLines.filter((_, i) => i !== index)
    }));
  };
  
  const updateOrderLine = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      salesOrderLines: prev.salesOrderLines.map((line, i) => 
        i === index ? { ...line, [field]: value } : line
      )
    }));
  };
  
  const handleItemSelect = async (index, itemId) => {
    updateOrderLine(index, 'itemId', itemId);
    
    // Auto-fill unit price from item
    const selectedItem = items.find(item => item._id === itemId);
    if (selectedItem) {
      updateOrderLine(index, 'unitPrice', selectedItem.unitPrice || 0);
    }
  };
  
  const calculateTotals = () => {
    const subTotal = formData.salesOrderLines.reduce((sum, line) => {
      const lineTotal = line.quantity * line.unitPrice;
      const discountAmount = (lineTotal * (line.discountPercent || 0)) / 100;
      return sum + (lineTotal - discountAmount);
    }, 0);
    
    return { subTotal, totalAmount: subTotal };
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to create sales order:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const { subTotal, totalAmount } = calculateTotals();
  
  return (
    <form onSubmit={handleSubmit} className="sales-order-form">
      <h2>Create Sales Order</h2>
      
      {/* Header Information */}
      <div className="form-section">
        <h3>Order Information</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Customer *</label>
            <select
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              required
            >
              <option value="">Select Customer</option>
              {customers.map(customer => (
                <option key={customer._id} value={customer._id}>
                  {customer.name} ({customer.code})
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-field">
            <label>Order Date *</label>
            <input
              type="date"
              value={formData.orderDate}
              onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
              required
            />
          </div>
          
          <div className="form-field">
            <label>Required Date *</label>
            <input
              type="date"
              value={formData.requiredDate}
              onChange={(e) => setFormData({ ...formData, requiredDate: e.target.value })}
              required
            />
          </div>
          
          <div className="form-field">
            <label>Payment Terms</label>
            <select
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
            >
              <option value="Cash">Cash</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="COD">COD</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Order Lines */}
      <div className="form-section">
        <div className="section-header">
          <h3>Order Items</h3>
          <button type="button" onClick={addOrderLine} className="btn-secondary">
            Add Item
          </button>
        </div>
        
        <div className="order-lines">
          {formData.salesOrderLines.map((line, index) => (
            <div key={index} className="order-line">
              <div className="form-grid">
                <div className="form-field">
                  <label>Item *</label>
                  <select
                    value={line.itemId}
                    onChange={(e) => handleItemSelect(index, e.target.value)}
                    required
                  >
                    <option value="">Select Item</option>
                    {items.map(item => (
                      <option key={item._id} value={item._id}>
                        {item.itemNumber} - {item.description}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-field">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(e) => updateOrderLine(index, 'quantity', parseFloat(e.target.value))}
                    required
                  />
                </div>
                
                <div className="form-field">
                  <label>Unit Price *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateOrderLine(index, 'unitPrice', parseFloat(e.target.value))}
                    required
                  />
                </div>
                
                <div className="form-field">
                  <label>Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={line.discountPercent}
                    onChange={(e) => updateOrderLine(index, 'discountPercent', parseFloat(e.target.value))}
                  />
                </div>
                
                <div className="form-field">
                  <label>Line Total</label>
                  <div className="line-total">
                    {((line.quantity * line.unitPrice) - ((line.quantity * line.unitPrice * (line.discountPercent || 0)) / 100)).toFixed(2)}
                  </div>
                </div>
                
                <div className="form-field">
                  <button
                    type="button"
                    onClick={() => removeOrderLine(index)}
                    className="btn-danger"
                    disabled={formData.salesOrderLines.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Totals */}
      <div className="form-section">
        <div className="order-totals">
          <div className="total-line">
            <span>Subtotal:</span>
            <span>{subTotal.toFixed(2)}</span>
          </div>
          <div className="total-line total">
            <span>Total Amount:</span>
            <span>{totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Notes */}
      <div className="form-section">
        <div className="form-field">
          <label>Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>
      
      {/* Actions */}
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Creating...' : 'Create Sales Order'}
        </button>
      </div>
    </form>
  );
};
```

## File Upload Integration

### Complete File Upload Workflow
```javascript
// components/FileUpload.jsx
import React, { useState, useRef } from 'react';
import { fileUploadService } from '../services/fileUploadService';

const FileUpload = ({ 
  uploadPath = 'general',
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.png'],
  onUploadComplete,
  onUploadError
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  const validateFile = (file) => {
    // Check file size
    if (file.size > maxFileSize) {
      throw new Error(`File ${file.name} is too large. Maximum size is ${(maxFileSize / (1024 * 1024)).toFixed(1)}MB`);
    }
    
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      throw new Error(`File type ${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return true;
  };
  
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('files', file);
    
    try {
      const response = await fetch(`/api/upload/${uploadPath}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data[0]; // Assuming single file upload
    } catch (error) {
      throw error;
    }
  };
  
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length + uploadedFiles.length > maxFiles) {
      onUploadError(`Maximum ${maxFiles} files allowed`);
      return;
    }
    
    setUploading(true);
    
    try {
      // Validate all files first
      files.forEach(validateFile);
      
      // Upload files one by one
      const uploadPromises = files.map(async (file, index) => {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        try {
          const uploadedFile = await uploadFile(file);
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
          return uploadedFile;
        } catch (error) {
          setUploadProgress(prev => ({ ...prev, [file.name]: -1 })); // Error state
          throw error;
        }
      });
      
      const results = await Promise.all(uploadPromises);
      const newUploadedFiles = [...uploadedFiles, ...results];
      setUploadedFiles(newUploadedFiles);
      
      if (onUploadComplete) {
        onUploadComplete(results, newUploadedFiles);
      }
      
    } catch (error) {
      if (onUploadError) {
        onUploadError(error.message);
      }
    } finally {
      setUploading(false);
      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress({});
      }, 2000);
    }
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeFile = (fileToRemove) => {
    const updatedFiles = uploadedFiles.filter(file => file.filename !== fileToRemove.filename);
    setUploadedFiles(updatedFiles);
    
    if (onUploadComplete) {
      onUploadComplete([], updatedFiles);
    }
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <div className="file-upload-component">
      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || uploadedFiles.length >= maxFiles}
          className="upload-button"
        >
          {uploading ? 'Uploading...' : 'Choose Files'}
        </button>
        
        <div className="upload-info">
          <small>
            Max {maxFiles} files, {(maxFileSize / (1024 * 1024)).toFixed(1)}MB each
          </small>
          <small>Allowed: {allowedTypes.join(', ')}</small>
        </div>
      </div>
      
      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="upload-progress">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="progress-item">
              <span className="filename">{filename}</span>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${progress === -1 ? 'error' : ''}`}
                  style={{ width: `${Math.max(0, progress)}%` }}
                />
              </div>
              <span className="progress-text">
                {progress === -1 ? 'Error' : `${progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <h4>Uploaded Files</h4>
          <div className="files-list">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <span className="file-name">{file.originalName}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  className="remove-file"
                  title="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
```

## Real-world Workflows

### Complete Order-to-Cash Workflow
```javascript
// workflows/orderToCash.js
import { customerService } from '../services/customerService';
import { salesOrderService } from '../services/salesOrderService';
import { inventoryService } from '../services/inventoryService';
import { emailService } from '../services/emailService';

export class OrderToCashWorkflow {
  async processNewOrder(orderData) {
    const workflow = {
      orderId: null,
      steps: [],
      status: 'started',
      errors: []
    };
    
    try {
      // Step 1: Validate customer
      workflow.steps.push({ step: 'customer_validation', status: 'started' });
      const customer = await customerService.getCustomer(orderData.customerId);
      if (!customer.data.isActive) {
        throw new Error('Customer is inactive');
      }
      workflow.steps[0].status = 'completed';
      
      // Step 2: Check inventory availability
      workflow.steps.push({ step: 'inventory_check', status: 'started' });
      const inventoryCheck = await this.checkInventoryAvailability(orderData.salesOrderLines);
      if (!inventoryCheck.available) {
        workflow.steps[1].status = 'failed';
        workflow.steps[1].error = 'Insufficient inventory';
        return { workflow, success: false };
      }
      workflow.steps[1].status = 'completed';
      
      // Step 3: Create sales order
      workflow.steps.push({ step: 'order_creation', status: 'started' });
      const salesOrder = await salesOrderService.createSalesOrder(orderData);
      workflow.orderId = salesOrder.data._id;
      workflow.steps[2].status = 'completed';
      
      // Step 4: Reserve inventory
      workflow.steps.push({ step: 'inventory_reservation', status: 'started' });
      await this.reserveInventory(salesOrder.data);
      workflow.steps[3].status = 'completed';
      
      // Step 5: Send confirmation email
      workflow.steps.push({ step: 'email_confirmation', status: 'started' });
      await emailService.sendSalesOrderConfirmation(customer.data, salesOrder.data);
      workflow.steps[4].status = 'completed';
      
      workflow.status = 'completed';
      return { workflow, success: true, orderId: workflow.orderId };
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.errors.push(error.message);
      
      // Rollback if necessary
      if (workflow.orderId) {
        await this.rollbackOrder(workflow.orderId);
      }
      
      return { workflow, success: false, error: error.message };
    }
  }
  
  async checkInventoryAvailability(orderLines) {
    const checks = await Promise.all(
      orderLines.map(async (line) => {
        const stock = await inventoryService.getStockBalance(line.itemId);
        return {
          itemId: line.itemId,
          requested: line.quantity,
          available: stock.data.availableQuantity,
          sufficient: stock.data.availableQuantity >= line.quantity
        };
      })
    );
    
    const insufficient = checks.filter(check => !check.sufficient);
    
    return {
      available: insufficient.length === 0,
      checks,
      insufficient
    };
  }
  
  async reserveInventory(salesOrder) {
    const reservations = await Promise.all(
      salesOrder.salesOrderLines.map(async (line) => {
        return await inventoryService.reserveStock({
          itemId: line.itemId,
          quantity: line.quantity,
          reservedFor: 'sales_order',
          referenceId: salesOrder._id
        });
      })
    );
    
    return reservations;
  }
  
  async rollbackOrder(orderId) {
    try {
      // Cancel the order
      await salesOrderService.updateOrderStatus(orderId, 'Cancelled');
      
      // Release any reserved inventory
      await inventoryService.releaseReservation({
        referenceId: orderId,
        reservationType: 'sales_order'
      });
      
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }
}

export const orderToCashWorkflow = new OrderToCashWorkflow();

// Usage in component
const processOrder = async (orderData) => {
  setProcessing(true);
  
  try {
    const result = await orderToCashWorkflow.processNewOrder(orderData);
    
    if (result.success) {
      notification.success('Order created successfully!');
      navigate(`/sales-orders/${result.orderId}`);
    } else {
      notification.error(`Order processing failed: ${result.error}`);
    }
  } catch (error) {
    notification.error('Unexpected error occurred');
  } finally {
    setProcessing(false);
  }
};
```

## Performance Optimization

### API Response Caching
```javascript
// utils/cache.js
class APICache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }
  
  generateKey(url, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    return `${url}?${JSON.stringify(sortedParams)}`;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }
  
  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear() {
    this.cache.clear();
  }
}

export const apiCache = new APICache();

// Enhanced service with caching
class CachedCustomerService extends CustomerService {
  async getCustomers(filters = {}) {
    const cacheKey = apiCache.generateKey('/customers', filters);
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const response = await super.getCustomers(filters);
    apiCache.set(cacheKey, response);
    return response;
  }
  
  async createCustomer(customerData) {
    const response = await super.createCustomer(customerData);
    // Invalidate customers cache
    apiCache.invalidate('/customers');
    return response;
  }
  
  async updateCustomer(customerId, updateData) {
    const response = await super.updateCustomer(customerId, updateData);
    // Invalidate specific customer and list cache
    apiCache.invalidate('/customers');
    apiCache.invalidate(`/customers/${customerId}`);
    return response;
  }
}
```

### Database Query Optimization
```javascript
// Optimized controller with efficient queries
export const getCustomersOptimized = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      businessType,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactNum: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (businessType) filter.businessType = businessType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Build sort object
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute queries in parallel
    const [customers, totalCount] = await Promise.all([
      CustomerModel
        .find(filter)
        .select('-__v') // Exclude version field
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Use lean() for better performance
      CustomerModel.countDocuments(filter)
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    res.json({
      status: 'success',
      data: {
        customers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: totalCount,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};
```

This comprehensive integration guide provides practical examples for implementing all major FMS features with proper error handling, performance optimization, and real-world workflow patterns. Use these examples as starting points and adapt them to your specific requirements.