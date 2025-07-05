const authController = require('../../controllers/authController');
const userService = require('../../services/userService');
const jwtUtils = require('../../utils/jwtUtils');
// const httpMocks = require('node-mocks-http'); // Bypassing this for now

// Mock services and utils
jest.mock('../../services/userService');
jest.mock('../../utils/jwtUtils');
// Manual mock for express-validator is in __mocks__
// We will simulate the validationResult object manually for error cases

// Helper to create manual mock req/res
const getMockReqRes = (body = {}, params = {}, user = null) => {
  const req = {
    body,
    params,
    user, // For authenticated routes
    header: jest.fn(), // For authMiddleware if it checks other headers
    // Simulate validationResult for error testing if needed
    _validationErrors: [], // Test can populate this to simulate validation failure
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(), // For simple responses
    // Store what was sent for assertions
    _json: null,
    _status: null,
  };
  // Capture status and json for assertions
  res.status = jest.fn((statusCode) => {
    res._status = statusCode;
    return res;
  });
  res.json = jest.fn((jsonData) => {
    if (res._status === null || res._status === undefined) { // If status not explicitly set, json() defaults to 200
        res._status = 200;
    }
    res._json = jsonData;
    return res;
  });
  return { req, res };
};


describe('Auth Controller', () => {
  let req, res; // next is not used by authController directly

  beforeEach(() => {
    // For most tests, req and res will be created within the test
    // This beforeEach will focus on resetting service mocks
    userService.findUserByEmail.mockReset();
    userService.validatePassword.mockReset();
    userService.createUser.mockReset();
    userService.findUserById.mockReset();
    jwtUtils.generateToken.mockReset();
    // jwtUtils.verifyToken is not directly used by authController, but by authMiddleware
  });

  describe('loginUser', () => {
    it('should login a user and return a token for valid credentials', async () => {
      ({ req, res } = getMockReqRes({ email: 'test@example.com', password: 'password123' }));
      const mockUser = { id: 'cuid123', email: 'test@example.com', password_hash: 'hashed', role: 'agent', username: 'testuser' };
      const mockToken = 'mocktoken123';

      userService.findUserByEmail.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(true);
      jwtUtils.generateToken.mockReturnValue(mockToken);

      await authController.loginUser(req, res);

      expect(userService.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userService.validatePassword).toHaveBeenCalledWith('password123', 'hashed');
      expect(jwtUtils.generateToken).toHaveBeenCalledWith({ user: { id: mockUser.id, role: mockUser.role, username: mockUser.username } });
      expect(res._status).toBe(200); // Use _status
      expect(res._json).toEqual({ // Use _json
        token: mockToken,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          role: mockUser.role,
        },
      });
    });

    it('should return 400 if email or password is not provided', async () => {
      ({ req, res } = getMockReqRes({ email: 'test@example.com' })); // Missing password
      await authController.loginUser(req, res);
      expect(res._status).toBe(400);
      expect(res._json.message).toBe('Please provide email and password');

      ({ req, res } = getMockReqRes({ password: 'password123' })); // Missing email
      await authController.loginUser(req, res);
      expect(res._status).toBe(400);
      expect(res._json.message).toBe('Please provide email and password');
    });

    it('should return 401 if email is not found', async () => {
      ({ req, res } = getMockReqRes({ email: 'unknown@example.com', password: 'password123' }));
      userService.findUserByEmail.mockResolvedValue(null);

      await authController.loginUser(req, res);
      expect(res._status).toBe(401);
      expect(res._json.message).toBe('Invalid credentials (email not found)');
    });

    it('should return 401 if password does not match', async () => {
      ({ req, res } = getMockReqRes({ email: 'test@example.com', password: 'wrongpassword' }));
      const mockUser = { id: 'cuid123', email: 'test@example.com', password_hash: 'hashed' };
      userService.findUserByEmail.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(false);

      await authController.loginUser(req, res);
      expect(res._status).toBe(401);
      expect(res._json.message).toBe('Invalid credentials (password incorrect)');
    });

    it('should return 500 if generateToken throws a configuration error', async () => {
        ({ req, res } = getMockReqRes({ email: 'test@example.com', password: 'password123' }));
        const mockUser = { id: 'cuid123', email: 'test@example.com', password_hash: 'hashed', role: 'agent', username: 'testuser' };

        userService.findUserByEmail.mockResolvedValue(mockUser);
        userService.validatePassword.mockResolvedValue(true);
        jwtUtils.generateToken.mockImplementation(() => {
          throw new Error('JWT_SECRET is not defined'); // Simulate config error
        });

        await authController.loginUser(req, res);
        expect(res._status).toBe(500);
        expect(res._json.message).toBe('Server configuration error during login.');
      });

    it('should return 500 for other server errors during login', async () => {
      ({ req, res } = getMockReqRes({ email: 'test@example.com', password: 'password123' }));
      userService.findUserByEmail.mockRejectedValue(new Error('Database exploded'));

      await authController.loginUser(req, res);
      expect(res._status).toBe(500);
      expect(res._json.message).toBe('Server error during login');
    });
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      ({ req, res } = getMockReqRes({ username: 'newuser', email: 'new@example.com', password: 'newpassword123', role: 'agent' }));
      const createdUser = { id: 'cuidnew', username: 'newuser', email: 'new@example.com', role: 'agent' };
      userService.createUser.mockResolvedValue(createdUser);

      await authController.registerUser(req, res);

      expect(userService.createUser).toHaveBeenCalledWith(req.body);
      expect(res._status).toBe(201);
      expect(res._json).toEqual({
        message: 'User registered successfully',
        user: createdUser,
      });
    });

    it('should return 400 if required fields are missing', async () => {
      ({ req, res } = getMockReqRes({ username: 'newuser' })); // Missing email and password
      await authController.registerUser(req, res);
      expect(res._status).toBe(400);
      expect(res._json.message).toBe('Please provide username, email, and password');
    });

    it('should return 400 if role is invalid', async () => {
        ({ req, res } = getMockReqRes({ username: 'newuser', email: 'new@example.com', password: 'newpassword123', role: 'invalidrole' }));
        await authController.registerUser(req, res);
        expect(res._status).toBe(400);
        expect(res._json.message).toBe('Invalid role specified.');
      });

    it('should return 409 if user already exists (conflict)', async () => {
      ({ req, res } = getMockReqRes({ username: 'existinguser', email: 'existing@example.com', password: 'password123' }));
      userService.createUser.mockRejectedValue(new Error('Email already exists.'));

      await authController.registerUser(req, res);
      expect(res._status).toBe(409);
      expect(res._json.message).toBe('Email already exists.');
    });

    it('should return 500 for other server errors during registration', async () => {
      ({ req, res } = getMockReqRes({ username: 'erroruser', email: 'error@example.com', password: 'password123' }));
      userService.createUser.mockRejectedValue(new Error('Some other DB error'));

      await authController.registerUser(req, res);
      expect(res._status).toBe(500);
      expect(res._json.message).toBe('Server error during registration');
    });
  });

  describe('getMe', () => {
    it('should return current user profile if authenticated', async () => {
      ({ req, res } = getMockReqRes({}, {}, { id: 'cuid123', role: 'admin', username: 'testadmin' })); // Mock authenticated user
      const mockUserProfile = { id: 'cuid123', username: 'testadmin', email: 'admin@example.com', role: 'admin' };
      userService.findUserById.mockResolvedValue(mockUserProfile);

      await authController.getMe(req, res);

      expect(userService.findUserById).toHaveBeenCalledWith('cuid123');
      expect(res._status).toBe(200);
      expect(res._json).toEqual(mockUserProfile);
    });

    it('should return 401 if user data not found in token (req.user missing)', async () => {
      ({ req, res } = getMockReqRes({}, {}, null)); // Simulate missing req.user
      await authController.getMe(req, res);
      expect(res._status).toBe(401);
      expect(res._json.message).toBe('Not authorized, user data not found in token');
    });

    it('should return 401 if user id not found in token (req.user.id missing)', async () => {
        ({ req, res } = getMockReqRes({}, {}, { role: 'admin' })); // Simulate missing req.user.id
        await authController.getMe(req, res);
        expect(res._status).toBe(401);
        expect(res._json.message).toBe('Not authorized, user data not found in token');
      });

    it('should return 404 if user not found in database by ID from token', async () => {
      ({ req, res } = getMockReqRes({}, {}, { id: 'cuid_not_found', role: 'user' }));
      userService.findUserById.mockResolvedValue(null);

      await authController.getMe(req, res);
      expect(res._status).toBe(404);
      expect(res._json.message).toBe('User not found');
    });

    it('should return 500 for server errors during getMe', async () => {
      ({ req, res } = getMockReqRes({}, {}, { id: 'cuid123' }));
      userService.findUserById.mockRejectedValue(new Error('Database connection lost'));

      await authController.getMe(req, res);
      expect(res._status).toBe(500);
      expect(res._json.message).toBe('Server error fetching profile');
    });
  });
});
