// backend/__mocks__/mysql2.js

const mysql2 = {
  createPool: jest.fn(() => ({
    promise: jest.fn(() => ({
      query: jest.fn().mockResolvedValue([[]]), // Default mock for query
      execute: jest.fn().mockResolvedValue([[]]), // Default mock for execute
      end: jest.fn().mockResolvedValue(undefined),
      // Add other pool/connection methods if they are directly called by your code and need mocking
    })),
    query: jest.fn((sql, params, callback) => {
      if (typeof callback === 'function') {
        callback(null, [[]], []); // Default mock for callback-style query
      }
      return this; // Allow chaining for non-promise pool usage if any
    }),
    execute: jest.fn((sql, params, callback) => {
      if (typeof callback === 'function') {
        callback(null, [[]], []);
      }
      return this;
    }),
    end: jest.fn(callback => {
      if (typeof callback === 'function') {
        callback();
      }
      return Promise.resolve();
    }),
    // Mock other pool methods if necessary
    getConnection: jest.fn((callback) => {
        const mockConnection = {
            promise: () => ({
                query: jest.fn().mockResolvedValue([[]]),
                release: jest.fn()
            }),
            query: jest.fn().mockImplementation((sql, params, cb) => cb(null, [[]])),
            release: jest.fn()
        };
        callback(null, mockConnection);
    })
  })),
  // Add other mysql2 exports if your code uses them directly, e.g., format
  format: jest.fn((sql, values) => {
    // Basic mock for format, replace ? with values
    let i = 0;
    return sql.replace(/\?/g, () => (values && values[i] !== undefined ? `'${values[i++]}'` : 'NULL'));
  }),
};

module.exports = mysql2;
