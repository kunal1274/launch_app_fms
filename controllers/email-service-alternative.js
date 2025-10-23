// Alternative email service configuration
import nodemailer from 'nodemailer';

// Option 1: SendGrid (Recommended)
const createSendGridTransporter = () => {
  return nodemailer.createTransporter({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY, // Your SendGrid API key
    },
  });
};

// Option 2: Mailgun
const createMailgunTransporter = () => {
  return nodemailer.createTransporter({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAILGUN_SMTP_USER, // Your Mailgun SMTP username
      pass: process.env.MAILGUN_SMTP_PASSWORD, // Your Mailgun SMTP password
    },
  });
};

// Option 3: AWS SES
const createSESTransporter = () => {
  return nodemailer.createTransporter({
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.AWS_SES_ACCESS_KEY_ID,
      pass: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });
};

// Option 4: Improved Gmail with retry logic
const createGmailTransporterWithRetry = () => {
  return nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 15000,   // 15 seconds
    socketTimeout: 30000,    // 30 seconds
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 20000, // 20 seconds
    rateLimit: 5, // 5 emails per 20 seconds
  });
};

export {
  createSendGridTransporter,
  createMailgunTransporter,
  createSESTransporter,
  createGmailTransporterWithRetry
};
