const { sequelize } = require('../data/dbconfig');

// Setup file for integration tests

beforeAll(async () => {
  console.log('Setting up integration test environment...');

  // Sync the database to ensure tables are created
  try {
    await sequelize.sync({ force: true });
    console.log('Test database initialized successfully.');
  } catch (error) {
    console.error('Error initializing test database:', error);
    throw error;
  }
});

afterAll(async () => {
  console.log('Cleaning up integration test environment...');

  // Close the database connection
  try {
    await sequelize.close();
    console.log('Test database connection closed successfully.');
  } catch (error) {
    console.error('Error closing test database connection:', error);
  }
});