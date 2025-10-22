/**
 * Email Service for FMS Application
 * This service handles all email-related operations
 */

import nodemailer from 'nodemailer';
import { asyncHandler } from '../utility/error.util.js';
import { handleBusinessLogicError } from '../utility/error.util.js';
import logger from '../utility/logger.util.js';

/**
 * Email Service Class
 */
export class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }

  /**
   * Create email transporter
   */
  createTransporter() {
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    return nodemailer.createTransporter(config);
  }

  /**
   * Send email
   */
  sendEmail = asyncHandler(async (emailData) => {
    try {
      const {
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        attachments,
        replyTo,
      } = emailData;

      // Validate required fields
      if (!to || !subject || (!text && !html)) {
        throw new Error('Missing required email fields: to, subject, and text/html');
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
        ...(cc && { cc: Array.isArray(cc) ? cc.join(', ') : cc }),
        ...(bcc && { bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc }),
        ...(replyTo && { replyTo }),
        ...(attachments && { attachments }),
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      logger.error('Email sending failed', {
        error: error.message,
        emailData: this.sanitizeEmailData(emailData),
      });
      handleBusinessLogicError(error);
    }
  });

  /**
   * Send welcome email
   */
  sendWelcomeEmail = asyncHandler(async (userData) => {
    const { name, email, temporaryPassword } = userData;

    const emailData = {
      to: email,
      subject: 'Welcome to FMS - Your Account is Ready',
      html: this.getWelcomeEmailTemplate(name, temporaryPassword),
      text: this.getWelcomeEmailTextTemplate(name, temporaryPassword),
    };

    return this.sendEmail(emailData);
  });

  /**
   * Send password reset email
   */
  sendPasswordResetEmail = asyncHandler(async (userData) => {
    const { name, email, resetToken } = userData;

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const emailData = {
      to: email,
      subject: 'Password Reset Request - FMS',
      html: this.getPasswordResetEmailTemplate(name, resetUrl),
      text: this.getPasswordResetEmailTextTemplate(name, resetUrl),
    };

    return this.sendEmail(emailData);
  });

  /**
   * Send notification email
   */
  sendNotificationEmail = asyncHandler(async (notificationData) => {
    const { to, subject, message, type = 'info' } = notificationData;

    const emailData = {
      to,
      subject: `FMS Notification: ${subject}`,
      html: this.getNotificationEmailTemplate(message, type),
      text: this.getNotificationEmailTextTemplate(message, type),
    };

    return this.sendEmail(emailData);
  });

  /**
   * Send order confirmation email
   */
  sendOrderConfirmationEmail = asyncHandler(async (orderData) => {
    const { customerEmail, customerName, orderNumber, orderDetails } = orderData;

    const emailData = {
      to: customerEmail,
      subject: `Order Confirmation - ${orderNumber}`,
      html: this.getOrderConfirmationEmailTemplate(customerName, orderNumber, orderDetails),
      text: this.getOrderConfirmationEmailTextTemplate(customerName, orderNumber, orderDetails),
    };

    return this.sendEmail(emailData);
  });

  /**
   * Send invoice email
   */
  sendInvoiceEmail = asyncHandler(async (invoiceData) => {
    const { customerEmail, customerName, invoiceNumber, invoiceDetails, attachment } = invoiceData;

    const emailData = {
      to: customerEmail,
      subject: `Invoice - ${invoiceNumber}`,
      html: this.getInvoiceEmailTemplate(customerName, invoiceNumber, invoiceDetails),
      text: this.getInvoiceEmailTextTemplate(customerName, invoiceNumber, invoiceDetails),
      attachments: attachment ? [attachment] : undefined,
    };

    return this.sendEmail(emailData);
  });

  /**
   * Send bulk email
   */
  sendBulkEmail = asyncHandler(async (bulkEmailData) => {
    const { recipients, subject, message, type = 'info' } = bulkEmailData;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients array is required for bulk email');
    }

    const results = [];
    const batchSize = 10; // Send in batches to avoid rate limiting

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(recipient => {
        const emailData = {
          to: recipient.email,
          subject,
          html: this.getBulkEmailTemplate(recipient.name, message, type),
          text: this.getBulkEmailTextTemplate(recipient.name, message, type),
        };

        return this.sendEmail(emailData);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    return {
      success: true,
      totalSent: recipients.length,
      results,
    };
  });

  /**
   * Verify email configuration
   */
  verifyConnection = asyncHandler(async () => {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return { success: true, message: 'Email service is ready' };
    } catch (error) {
      logger.error('Email service connection failed', { error: error.message });
      throw new Error('Email service connection failed');
    }
  });

  /**
   * Email templates
   */
  getWelcomeEmailTemplate(name, temporaryPassword) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to FMS</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FMS</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Your account has been successfully created. Here are your login credentials:</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            <p>Please log in and change your password immediately for security reasons.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from FMS. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeEmailTextTemplate(name, temporaryPassword) {
    return `
      Welcome to FMS!
      
      Hello ${name}!
      
      Your account has been successfully created. Here are your login credentials:
      
      Temporary Password: ${temporaryPassword}
      
      Please log in and change your password immediately for security reasons.
      
      If you have any questions, please contact our support team.
      
      This is an automated message from FMS. Please do not reply to this email.
    `;
  }

  getPasswordResetEmailTemplate(name, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset - FMS</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>You have requested to reset your password. Click the button below to reset your password:</p>
            <p><a href="${resetUrl}" class="button">Reset Password</a></p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${resetUrl}</p>
            <p>This link will expire in 24 hours for security reasons.</p>
          </div>
          <div class="footer">
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordResetEmailTextTemplate(name, resetUrl) {
    return `
      Password Reset Request - FMS
      
      Hello ${name}!
      
      You have requested to reset your password. Click the link below to reset your password:
      
      ${resetUrl}
      
      This link will expire in 24 hours for security reasons.
      
      If you didn't request this password reset, please ignore this email.
    `;
  }

  getNotificationEmailTemplate(message, type) {
    const colors = {
      info: '#007bff',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FMS Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${colors[type] || colors.info}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FMS Notification</h1>
          </div>
          <div class="content">
            <p>${message}</p>
          </div>
          <div class="footer">
            <p>This is an automated message from FMS.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getNotificationEmailTextTemplate(message, type) {
    return `
      FMS Notification
      
      ${message}
      
      This is an automated message from FMS.
    `;
  }

  getOrderConfirmationEmailTemplate(customerName, orderNumber, orderDetails) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - ${orderNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .order-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
            <p>Order #${orderNumber}</p>
          </div>
          <div class="content">
            <h2>Hello ${customerName}!</h2>
            <p>Thank you for your order. We have received your order and will process it shortly.</p>
            <div class="order-details">
              <h3>Order Details:</h3>
              <p>${orderDetails}</p>
            </div>
            <p>We will send you another email when your order is shipped.</p>
          </div>
          <div class="footer">
            <p>Thank you for choosing FMS!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getOrderConfirmationEmailTextTemplate(customerName, orderNumber, orderDetails) {
    return `
      Order Confirmation - ${orderNumber}
      
      Hello ${customerName}!
      
      Thank you for your order. We have received your order and will process it shortly.
      
      Order Details:
      ${orderDetails}
      
      We will send you another email when your order is shipped.
      
      Thank you for choosing FMS!
    `;
  }

  getInvoiceEmailTemplate(customerName, invoiceNumber, invoiceDetails) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6f42c1; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .invoice-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice</h1>
            <p>Invoice #${invoiceNumber}</p>
          </div>
          <div class="content">
            <h2>Hello ${customerName}!</h2>
            <p>Please find attached your invoice for the services provided.</p>
            <div class="invoice-details">
              <h3>Invoice Details:</h3>
              <p>${invoiceDetails}</p>
            </div>
            <p>If you have any questions about this invoice, please contact our billing department.</p>
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getInvoiceEmailTextTemplate(customerName, invoiceNumber, invoiceDetails) {
    return `
      Invoice - ${invoiceNumber}
      
      Hello ${customerName}!
      
      Please find attached your invoice for the services provided.
      
      Invoice Details:
      ${invoiceDetails}
      
      If you have any questions about this invoice, please contact our billing department.
      
      Thank you for your business!
    `;
  }

  getBulkEmailTemplate(name, message, type) {
    return this.getNotificationEmailTemplate(`Hello ${name},\n\n${message}`, type);
  }

  getBulkEmailTextTemplate(name, message, type) {
    return this.getNotificationEmailTextTemplate(`Hello ${name},\n\n${message}`, type);
  }

  /**
   * Sanitize email data for logging
   */
  sanitizeEmailData(emailData) {
    const sanitized = { ...emailData };
    if (sanitized.text) sanitized.text = '[REDACTED]';
    if (sanitized.html) sanitized.html = '[REDACTED]';
    return sanitized;
  }
}

// Create and export service instance
export const emailService = new EmailService();

export default emailService;
