/**
 * Notification Service for FMS Application
 * This service handles all notification-related operations
 */

import { asyncHandler } from '../utility/error.util.js';
import { handleBusinessLogicError } from '../utility/error.util.js';
import { emailService } from './email.service.js';
import logger from '../utility/logger.util.js';

/**
 * Notification Service Class
 */
export class NotificationService {
  constructor() {
    this.channels = {
      email: emailService,
      // Add other channels like SMS, push notifications, etc.
    };
  }

  /**
   * Send notification through multiple channels
   */
  sendNotification = asyncHandler(async (notificationData) => {
    const {
      recipients,
      channels = ['email'],
      subject,
      message,
      type = 'info',
      priority = 'normal',
      data = {},
    } = notificationData;

    if (!recipients || recipients.length === 0) {
      throw new Error('Recipients are required for notification');
    }

    if (!subject || !message) {
      throw new Error('Subject and message are required for notification');
    }

    const results = [];

    for (const channel of channels) {
      if (!this.channels[channel]) {
        logger.warn(`Notification channel '${channel}' not available`);
        continue;
      }

      try {
        const result = await this.sendThroughChannel(channel, {
          recipients,
          subject,
          message,
          type,
          priority,
          data,
        });

        results.push({
          channel,
          success: true,
          result,
        });

        logger.info(`Notification sent through ${channel}`, {
          recipients: recipients.length,
          subject,
          type,
        });
      } catch (error) {
        logger.error(`Notification failed through ${channel}`, {
          error: error.message,
          recipients: recipients.length,
          subject,
        });

        results.push({
          channel,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
      totalRecipients: recipients.length,
    };
  });

  /**
   * Send notification through specific channel
   */
  sendThroughChannel = asyncHandler(async (channel, notificationData) => {
    const { recipients, subject, message, type, priority, data } = notificationData;

    switch (channel) {
      case 'email':
        return this.sendEmailNotification(recipients, subject, message, type, data);
      
      case 'sms':
        return this.sendSMSNotification(recipients, message, type, data);
      
      case 'push':
        return this.sendPushNotification(recipients, subject, message, type, data);
      
      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }
  });

  /**
   * Send email notification
   */
  sendEmailNotification = asyncHandler(async (recipients, subject, message, type, data) => {
    const emailData = {
      to: recipients.map(r => r.email || r),
      subject,
      message,
      type,
    };

    return emailService.sendNotificationEmail(emailData);
  });

  /**
   * Send SMS notification (placeholder for future implementation)
   */
  sendSMSNotification = asyncHandler(async (recipients, message, type, data) => {
    // TODO: Implement SMS service integration
    logger.info('SMS notification requested', {
      recipients: recipients.length,
      message: message.substring(0, 50) + '...',
      type,
    });

    return {
      success: true,
      message: 'SMS notification service not yet implemented',
    };
  });

  /**
   * Send push notification (placeholder for future implementation)
   */
  sendPushNotification = asyncHandler(async (recipients, subject, message, type, data) => {
    // TODO: Implement push notification service integration
    logger.info('Push notification requested', {
      recipients: recipients.length,
      subject,
      message: message.substring(0, 50) + '...',
      type,
    });

    return {
      success: true,
      message: 'Push notification service not yet implemented',
    };
  });

  /**
   * Send system notification
   */
  sendSystemNotification = asyncHandler(async (notificationData) => {
    const {
      userIds,
      subject,
      message,
      type = 'info',
      priority = 'normal',
      data = {},
    } = notificationData;

    // Get user emails for system notifications
    const recipients = userIds.map(userId => ({
      userId,
      email: data.userEmails?.[userId] || 'system@fms.com',
    }));

    return this.sendNotification({
      recipients,
      channels: ['email'],
      subject: `[System] ${subject}`,
      message,
      type,
      priority,
      data,
    });
  });

  /**
   * Send user notification
   */
  sendUserNotification = asyncHandler(async (notificationData) => {
    const {
      userIds,
      subject,
      message,
      type = 'info',
      priority = 'normal',
      data = {},
    } = notificationData;

    // Get user details for notifications
    const recipients = userIds.map(userId => ({
      userId,
      email: data.userEmails?.[userId],
      name: data.userNames?.[userId],
    })).filter(r => r.email); // Only include users with email

    if (recipients.length === 0) {
      throw new Error('No valid recipients found for user notification');
    }

    return this.sendNotification({
      recipients,
      channels: ['email'],
      subject,
      message,
      type,
      priority,
      data,
    });
  });

  /**
   * Send order notification
   */
  sendOrderNotification = asyncHandler(async (orderData) => {
    const {
      customerEmail,
      customerName,
      orderNumber,
      orderStatus,
      orderDetails,
    } = orderData;

    const subject = `Order ${orderStatus} - ${orderNumber}`;
    const message = `Your order #${orderNumber} has been ${orderStatus.toLowerCase()}.`;

    return this.sendNotification({
      recipients: [{ email: customerEmail, name: customerName }],
      channels: ['email'],
      subject,
      message,
      type: 'info',
      data: { orderNumber, orderStatus, orderDetails },
    });
  });

  /**
   * Send payment notification
   */
  sendPaymentNotification = asyncHandler(async (paymentData) => {
    const {
      customerEmail,
      customerName,
      paymentAmount,
      paymentStatus,
      transactionId,
    } = paymentData;

    const subject = `Payment ${paymentStatus} - ${transactionId}`;
    const message = `Your payment of $${paymentAmount} has been ${paymentStatus.toLowerCase()}.`;

    return this.sendNotification({
      recipients: [{ email: customerEmail, name: customerName }],
      channels: ['email'],
      subject,
      message,
      type: paymentStatus === 'success' ? 'success' : 'error',
      data: { paymentAmount, paymentStatus, transactionId },
    });
  });

  /**
   * Send inventory notification
   */
  sendInventoryNotification = asyncHandler(async (inventoryData) => {
    const {
      adminEmails,
      itemName,
      currentStock,
      minStock,
      action = 'low_stock',
    } = inventoryData;

    let subject, message;

    switch (action) {
      case 'low_stock':
        subject = 'Low Stock Alert';
        message = `Item "${itemName}" is running low. Current stock: ${currentStock}, Minimum required: ${minStock}`;
        break;
      case 'out_of_stock':
        subject = 'Out of Stock Alert';
        message = `Item "${itemName}" is out of stock. Current stock: ${currentStock}`;
        break;
      case 'stock_updated':
        subject = 'Stock Updated';
        message = `Stock for item "${itemName}" has been updated. New stock: ${currentStock}`;
        break;
      default:
        subject = 'Inventory Notification';
        message = `Inventory update for item "${itemName}". Current stock: ${currentStock}`;
    }

    const recipients = adminEmails.map(email => ({ email }));

    return this.sendNotification({
      recipients,
      channels: ['email'],
      subject,
      message,
      type: action === 'out_of_stock' ? 'error' : 'warning',
      priority: action === 'out_of_stock' ? 'high' : 'normal',
      data: { itemName, currentStock, minStock, action },
    });
  });

  /**
   * Send audit notification
   */
  sendAuditNotification = asyncHandler(async (auditData) => {
    const {
      adminEmails,
      action,
      resource,
      resourceId,
      userId,
      userName,
      timestamp,
    } = auditData;

    const subject = `Audit Alert: ${action} on ${resource}`;
    const message = `User ${userName} (${userId}) performed ${action} on ${resource} (ID: ${resourceId}) at ${timestamp}.`;

    const recipients = adminEmails.map(email => ({ email }));

    return this.sendNotification({
      recipients,
      channels: ['email'],
      subject,
      message,
      type: 'warning',
      priority: 'high',
      data: auditData,
    });
  });

  /**
   * Send scheduled notification
   */
  sendScheduledNotification = asyncHandler(async (scheduledData) => {
    const {
      recipients,
      subject,
      message,
      type = 'info',
      scheduleTime,
      data = {},
    } = scheduledData;

    // Check if it's time to send the notification
    const now = new Date();
    const schedule = new Date(scheduleTime);

    if (now < schedule) {
      logger.info('Scheduled notification not yet due', {
        scheduleTime,
        now: now.toISOString(),
      });
      return { success: false, message: 'Notification not yet due' };
    }

    return this.sendNotification({
      recipients,
      channels: ['email'],
      subject,
      message,
      type,
      data,
    });
  });

  /**
   * Get notification statistics
   */
  getNotificationStats = asyncHandler(async (timeRange = '24h') => {
    // TODO: Implement notification statistics
    // This would typically query a notifications collection
    logger.info('Notification statistics requested', { timeRange });

    return {
      totalSent: 0,
      successRate: 0,
      channelStats: {
        email: { sent: 0, failed: 0 },
        sms: { sent: 0, failed: 0 },
        push: { sent: 0, failed: 0 },
      },
      typeStats: {
        info: 0,
        success: 0,
        warning: 0,
        error: 0,
      },
    };
  });

  /**
   * Test notification service
   */
  testNotification = asyncHandler(async (testData) => {
    const {
      email,
      channels = ['email'],
      message = 'This is a test notification from FMS',
    } = testData;

    return this.sendNotification({
      recipients: [{ email }],
      channels,
      subject: 'Test Notification',
      message,
      type: 'info',
      data: { test: true },
    });
  });
}

// Create and export service instance
export const notificationService = new NotificationService();

export default notificationService;
