import { Sequelize } from 'sequelize';

// Initialize Sequelize instance
export const sequelize = new Sequelize('document_management', 'username', 'password', {
  host: 'localhost',
  dialect: 'mysql', // Change to your preferred database dialect (e.g., 'postgres', 'sqlite', 'mssql')
});

// Test database connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();