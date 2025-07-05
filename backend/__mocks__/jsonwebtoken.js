// backend/__mocks__/jsonwebtoken.js

// backend/__mocks__/jsonwebtoken.js
const jsonwebtoken = {
  sign: jest.fn((payload, secret, options) => {
    console.log('MOCK jwt.sign CALLED WITH:', { payload, secret, options }); // DEBUG
    return `mockToken_payload_${JSON.stringify(payload)}_secret_${secret}_options_${JSON.stringify(options)}`;
  }),
  verify: jest.fn((token, secret) => {
    console.log('MOCK jwt.verify CALLED WITH:', { token, secret }); // DEBUG
    if (typeof token === 'string' && token.startsWith('mockToken_payload_')) {
      try {
        const payloadString = token.substring('mockToken_payload_'.length).split('_secret_')[0];
        return JSON.parse(payloadString);
      } catch (e) {
        throw new Error('jwt malformed (mock)');
      }
    } else if (token === 'expiredMockToken') {
        const error = new Error('jwt expired (mock)');
        error.name = 'TokenExpiredError';
        throw error;
    } else {
      throw new Error('invalid signature (mock)');
    }
  }),
  // Add other functions if your code uses them, e.g., decode
  // decode: jest.fn(),
};

module.exports = jsonwebtoken;
