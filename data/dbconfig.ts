import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Sequelize instance with environment-specific credentials
export const sequelize = new Sequelize(
  process.env.DB_NAME || 'document_management',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
  }
);

// Test database connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();