const authMiddleware = require('../../middleware/authMiddleware');
const jwtUtils = require('../../utils/jwtUtils'); // To be mocked
// No need for httpMocks if we manually create req, res, next

// Mock jwtUtils
jest.mock('../../utils/jwtUtils');

// Helper to create manual mock req, res, next for middleware
const getMiddlewareMocks = (headers = {}, userInToken = null) => {
  const req = {
    header: jest.fn(headerName => headers[headerName.toLowerCase()]), // Case-insensitive header check
    user: null, // Will be populated by middleware
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    _json: null,
    _status: null,
  };
  res.status = jest.fn((statusCode) => {
    res._status = statusCode;
    return res;
  });
  res.json = jest.fn((jsonData) => {
    if (res._status === null || res._status === undefined) {
        res._status = 200; // Though typically error responses will set status first
    }
    res._json = jsonData;
    return res;
  });
  const next = jest.fn();

  // Setup mock for jwtUtils.verifyToken based on userInToken
  if (userInToken) {
    jwtUtils.verifyToken.mockReturnValue({ user: userInToken });
  } else {
    // Default to token being invalid or user data missing, unless specifically overridden in a test
    jwtUtils.verifyToken.mockReturnValue(null);
  }

  return { req, res, next };
};

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks for each test
    jwtUtils.verifyToken.mockReset();
  });

  it('should call next() and attach user to req if token is valid (Bearer token)', () => {
    const mockUserPayload = { id: 'cuid123', role: 'user', username: 'testuser' };
    ({ req, res, next } = getMiddlewareMocks(
      { 'authorization': 'Bearer validtoken123' },
      mockUserPayload // This will make verifyToken return { user: mockUserPayload }
    ));

    authMiddleware(req, res, next);

    expect(jwtUtils.verifyToken).toHaveBeenCalledWith('validtoken123');
    expect(req.user).toEqual(mockUserPayload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBeNull(); // No error response
  });

  it('should call next() and attach user to req if token is valid (x-auth-token)', () => {
    const mockUserPayload = { id: 'cuid456', role: 'admin', username: 'adminuser' };
    ({ req, res, next } = getMiddlewareMocks(
      { 'x-auth-token': 'validtoken456' },
      mockUserPayload
    ));

    authMiddleware(req, res, next);

    expect(jwtUtils.verifyToken).toHaveBeenCalledWith('validtoken456');
    expect(req.user).toEqual(mockUserPayload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBeNull();
  });

  it('should return 401 if no token is provided', () => {
    ({ req, res, next } = getMiddlewareMocks()); // No headers, no user in token for verifyToken mock

    authMiddleware(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.message).toBe('No token, authorization denied');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is not valid (verifyToken returns null)', () => {
    ({ req, res, next } = getMiddlewareMocks(
      { 'authorization': 'Bearer invalidtoken' },
      null // This makes verifyToken return null
    ));
    // jwtUtils.verifyToken is already mocked to return null by default in getMiddlewareMocks if userInToken is null

    authMiddleware(req, res, next);

    expect(jwtUtils.verifyToken).toHaveBeenCalledWith('invalidtoken');
    expect(res._status).toBe(401);
    expect(res._json.message).toBe('Token is not valid or user data missing in token');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if verifyToken returns payload without user property', () => {
    ({ req, res, next } = getMiddlewareMocks(
      { 'authorization': 'Bearer tokenwithmissinguser' }
      // No userInToken, so verifyToken returns null by default. Let's override.
    ));
    jwtUtils.verifyToken.mockReturnValue({}); // Decoded payload exists but no 'user' property

    authMiddleware(req, res, next);

    expect(jwtUtils.verifyToken).toHaveBeenCalledWith('tokenwithmissinguser');
    expect(res._status).toBe(401);
    expect(res._json.message).toBe('Token is not valid or user data missing in token');
    expect(next).not.toHaveBeenCalled();
  });


  it('should return 401 if verifyToken throws an unexpected error (simulating internal jwtUtils issue)', () => {
    ({ req, res, next } = getMiddlewareMocks({ 'authorization': 'Bearer problematictoken' }));
    jwtUtils.verifyToken.mockImplementation(() => {
      throw new Error('Some internal JWT error');
    });

    authMiddleware(req, res, next);

    expect(jwtUtils.verifyToken).toHaveBeenCalledWith('problematictoken');
    expect(res._status).toBe(401);
    expect(res._json.message).toBe('Token is not valid (middleware error)');
    expect(next).not.toHaveBeenCalled();
  });
});
