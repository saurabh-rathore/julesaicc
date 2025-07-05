// backend/__mocks__/bcryptjs.js

// Completely manual mock, not using jest.createMockFromModule

const mockBcrypt = {
  genSalt: jest.fn(() => Promise.resolve('mockSalt')),
  hash: jest.fn((password, salt) => Promise.resolve(`mockHashed_${password}_with_${salt}`)),
  compare: jest.fn((password, hash) => {
    // A more plausible mock for compare:
    // If the hash was created with a known structure by the mocked hash function,
    // we can try to reverse that logic for a more realistic compare.
    // For example, if hash is `mockHashed_${password}_with_${salt}`
    if (typeof hash === 'string' && hash.startsWith('mockHashed_')) {
      const parts = hash.split('_with_'); // ['mockHashed_password', 'salt']
      const originalPasswordPart = parts[0].substring('mockHashed_'.length);
      return Promise.resolve(originalPasswordPart === password);
    }
    // Fallback for unexpected hash format or if password isn't part of the mock hash
    return Promise.resolve(false);
  }),
};

module.exports = mockBcrypt;
