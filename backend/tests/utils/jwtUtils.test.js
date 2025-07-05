// const jwtUtils = require('../../utils/jwtUtils'); // Will be dynamically imported
// const jwt = require('jsonwebtoken'); // This will be required inside beforeEach

// Mock jsonwebtoken is implicitly handled by placing a mock in __mocks__/jsonwebtoken.js

const originalEnv = { ...process.env }; // Store original env, spread to ensure a copy

describe('JWT Utils', () => {
  let jwtUtils; // To store the dynamically imported module under test
  let mockJwt;  // To store the dynamically imported mock of jsonwebtoken

  beforeEach(() => {
    jest.resetModules(); // Crucial: resets module cache

    // Restore a clean copy of original process.env, then set specific test values
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'a_default_test_secret';

    // Require the mock first, so 'mockJwt' holds the fresh mock instance
    mockJwt = require('jsonwebtoken');
    // Then require the module under test, which will also get this fresh mock instance
    jwtUtils = require('../../utils/jwtUtils');
    // console.log('INSIDE jwtUtils.test.js beforeEach, mockJwt object:', mockJwt); // DEBUG LINE - REMOVED

    // Reset mocks on the fresh mockJwt instance
    if (mockJwt.sign && mockJwt.sign.mockReset) mockJwt.sign.mockReset();
    if (mockJwt.verify && mockJwt.verify.mockReset) mockJwt.verify.mockReset();
  });

  afterAll(() => {
    // Restore original process.env after all tests
    process.env = originalEnv;
  });

  describe('generateToken', () => {
    it('should generate a token successfully with default expiration', () => {
      const userPayload = { user: { id: 'userid1', role: 'user' } };
      const mockToken = 'mockGeneratedToken';
      mockJwt.sign.mockReturnValue(mockToken); // Use mockJwt

      const token = jwtUtils.generateToken(userPayload);

      // JWT_SECRET was 'a_default_test_secret' when jwtUtils was loaded in beforeEach
      expect(mockJwt.sign).toHaveBeenCalledWith(userPayload, 'a_default_test_secret', { expiresIn: '1h' }); // Use mockJwt
      expect(token).toBe(mockToken);
    });

    it('should generate a token successfully with custom expiration from .env', () => {
      process.env.JWT_EXPIRES_IN = '2d';
      // Re-require jwtUtils because JWT_EXPIRES_IN is captured at module load time
      jest.resetModules(); // Reset before setting env var for this specific test's module load
      process.env.JWT_SECRET = 'a_default_test_secret'; // Keep JWT_SECRET defined
      process.env.JWT_EXPIRES_IN = '2d'; // Ensure this is set before re-requiring
      const localJwtUtils = require('../../utils/jwtUtils');
      const localMockJwt = require('jsonwebtoken'); // Get the fresh mock paired with localJwtUtils

      const userPayload = { user: { id: 'userid2', role: 'admin' } };
      const mockToken = 'anotherMockToken';
      localMockJwt.sign.mockReturnValue(mockToken);

      const token = localJwtUtils.generateToken(userPayload);

      expect(localMockJwt.sign).toHaveBeenCalledWith(userPayload, 'a_default_test_secret', { expiresIn: '2d' });
      expect(token).toBe(mockToken);
    });

    it('should throw an error if JWT_SECRET is not defined AT MODULE LOAD', () => {
      delete process.env.JWT_SECRET; // Delete before re-requiring
      jest.resetModules(); // Ensure module reloads
      const localJwtUtils = require('../../utils/jwtUtils'); // Re-require to capture undefined JWT_SECRET

      const userPayload = { user: { id: 'userid3' } };
      expect(() => localJwtUtils.generateToken(userPayload)).toThrow('JWT_SECRET is not defined. Please check your .env file.');
    });

    it('should throw an error if userPayload is invalid', () => {
      // JWT_SECRET is 'a_default_test_secret' from beforeEach
      expect(() => jwtUtils.generateToken(null)).toThrow('Invalid userPayload for JWT generation.');
      expect(() => jwtUtils.generateToken('not_an_object')).toThrow('Invalid userPayload for JWT generation.');
    });
  });

  describe('verifyToken', () => {
    it('should verify a token successfully and return the payload', () => {
      // JWT_SECRET is 'a_default_test_secret'
      const mockToken = 'validMockToken';
      const mockDecodedPayload = { user: { id: 'userid1', role: 'user' }, iat: 123, exp: 456 };
      mockJwt.verify.mockReturnValue(mockDecodedPayload); // Use mockJwt

      const payload = jwtUtils.verifyToken(mockToken);

      expect(mockJwt.verify).toHaveBeenCalledWith(mockToken, 'a_default_test_secret'); // Use mockJwt
      expect(payload).toEqual(mockDecodedPayload);
    });

    it('should return null if token verification fails (e.g., invalid signature, expired)', () => {
      // JWT_SECRET is 'a_default_test_secret'
      const mockInvalidToken = 'invalidOrExpiredToken';

      // Explicitly set the mock to throw for this test, because mockReset in beforeEach clears default __mocks__ implementations
      mockJwt.verify.mockImplementationOnce(() => {
        throw new Error('Simulated JWT Error');
      });

      const payload = jwtUtils.verifyToken(mockInvalidToken);
      expect(payload).toBeNull();
    });

    it('should return null if token is not provided', () => {
        // JWT_SECRET is 'a_default_test_secret'
        const payload = jwtUtils.verifyToken(null);
        expect(payload).toBeNull();
        expect(mockJwt.verify).not.toHaveBeenCalled(); // Use mockJwt
      });

    it('should throw an error if JWT_SECRET is not defined AT MODULE LOAD during verification', () => {
      delete process.env.JWT_SECRET; // Delete before re-requiring
      jest.resetModules(); // Ensure module reloads
      const localJwtUtils = require('../../utils/jwtUtils'); // Re-require

      const mockToken = 'anytoken';
      expect(() => localJwtUtils.verifyToken(mockToken)).toThrow('JWT_SECRET is not defined. Please check your .env file.');
    });
  });
});
