// backend/__mocks__/dotenv.js

const dotenv = {
  config: jest.fn(() => {
    // This mock implementation of config() does nothing by default.
    // Tests that rely on process.env variables being set by dotenv
    // will need to set them directly using `process.env.MY_VAR = 'value'`
    // in the test setup (e.g., beforeEach).
    // console.log('Mocked dotenv.config() called'); // For debugging if needed
    return { parsed: {} }; // Mimic successful parsing with no actual values
  }),
};

module.exports = dotenv;
