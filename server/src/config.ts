import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appchargeApiKey: process.env.APPCHARGE_API_KEY || '',
  appchargePublisherToken: process.env.APPCHARGE_PUBLISHER_TOKEN || '31aad4aa345b4e370ecf64633ae7447056b5c756e1a0747cdebcdd29071bfcf8',
  appchargeWebstoreUrl: process.env.APPCHARGE_WEBSTORE_URL || '',
  appchargeApiBase: process.env.APPCHARGE_API_BASE || 'https://api-sandbox.appcharge.com',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
