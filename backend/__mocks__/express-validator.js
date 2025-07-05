// backend/__mocks__/express-validator.js

const expressValidator = {
  // Mock for body, check, param, query, etc. if you were using them to build chains
  // For controller tests, we primarily care about validationResult
  body: jest.fn(() => expressValidator), // Return self for chaining
  check: jest.fn(() => expressValidator), // Return self for chaining
  param: jest.fn(() => expressValidator), // Return self for chaining
  query: jest.fn(() => expressValidator), // Return self for chaining
  isEmail: jest.fn(() => expressValidator),
  exists: jest.fn(() => expressValidator),
  not: jest.fn(() => expressValidator), // For .not().isEmpty()
  isEmpty: jest.fn(() => true), // Default for .not().isEmpty() or direct isEmpty()
  isLength: jest.fn(() => expressValidator),
  isIn: jest.fn(() => expressValidator),
  optional: jest.fn(() => expressValidator),
  // ... other validators you might use ...

  // Mock for validationResult
  validationResult: jest.fn((req) => {
    // Default behavior: no errors
    // Tests can override this by mocking specific implementations if they want to test error paths
    const mockErrors = {
      isEmpty: jest.fn(() => true), // Default to no errors
      array: jest.fn(() => []),     // Default to empty array of errors
    };

    // If tests set up req._validationErrors, use that
    if (req && req._validationErrors) {
        mockErrors.isEmpty = jest.fn(() => req._validationErrors.length === 0);
        mockErrors.array = jest.fn(() => req._validationErrors);
    }

    return mockErrors;
  }),
};

module.exports = expressValidator;
