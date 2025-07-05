// backend/__mocks__/cuid.js

const cuid = jest.fn();

// Default mock implementation, can be overridden in tests if needed
cuid.mockImplementation(() => 'mockCuid12345');

module.exports = cuid;
