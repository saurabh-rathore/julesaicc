const userService = require('../../services/userService');
const { promisePool } = require('../../config/db'); // To be mocked
const bcrypt = require('bcryptjs'); // This will now import from __mocks__/bcryptjs.js
const cuid = require('cuid'); // This will import from __mocks__/cuid.js

// Mock the db connection pool
jest.mock('../../config/db', () => ({
  promisePool: {
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined) // Mock end function if used in services
  }
}));

// Mock bcrypt functions
// jest.mock('bcryptjs', () => ({ // Now using manual mock from __mocks__/bcryptjs.js
//   genSalt: jest.fn(),
//   hash: jest.fn(),
//   compare: jest.fn()
// }));

// Mock cuid
// jest.mock('cuid', () => jest.fn()); // Now using manual mock from __mocks__/cuid.js

describe('User Service', () => {
  beforeEach(() => {
    // Reset mocks before each test
    promisePool.query.mockReset();
    bcrypt.genSalt.mockReset();
    bcrypt.hash.mockReset();
    bcrypt.compare.mockReset();
    cuid.mockReset();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = { username: 'testuser', email: 'test@example.com', password: 'password123', role: 'agent' };
      const mockUserId = 'cuidtest123';
      const mockSalt = 'somesalt';
      const mockHashedPassword = 'hashedpassword';

      promisePool.query
        .mockResolvedValueOnce([[]]) // For checking existing user (empty means not found)
        .mockResolvedValueOnce(undefined); // For INSERT query

      bcrypt.genSalt.mockResolvedValue(mockSalt);
      bcrypt.hash.mockResolvedValue(mockHashedPassword);
      cuid.mockReturnValue(mockUserId);

      const result = await userService.createUser(userData);

      expect(promisePool.query).toHaveBeenCalledTimes(2);
      expect(promisePool.query).toHaveBeenNthCalledWith(1, 'SELECT id FROM users WHERE email = ? OR username = ?', [userData.email, userData.username]);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, mockSalt);
      expect(cuid).toHaveBeenCalledTimes(1);
      expect(promisePool.query).toHaveBeenNthCalledWith(2, 'INSERT INTO users SET ?', {
        id: mockUserId,
        username: userData.username,
        email: userData.email,
        password_hash: mockHashedPassword,
        role: userData.role
      });
      expect(result).toEqual({
        id: mockUserId,
        username: userData.username,
        email: userData.email,
        role: userData.role
      });
    });

    it('should throw an error if username, email, or password is not provided', async () => {
      await expect(userService.createUser({ username: 'test' })).rejects.toThrow('Username, email, and password are required');
    });

    it('should throw an error if email already exists', async () => {
      const userData = { username: 'testuser', email: 'test@example.com', password: 'password123' };
      promisePool.query.mockResolvedValueOnce([[{ id: 'cuid1', email: 'test@example.com' }]]); // Simulate email exists

      await expect(userService.createUser(userData)).rejects.toThrow('Email already exists.');
    });

    it('should throw an error if username already exists', async () => {
        const userData = { username: 'testuser', email: 'test@example.com', password: 'password123' };
        promisePool.query.mockResolvedValueOnce([[{ id: 'cuid1', username: 'testuser' }]]); // Simulate username exists

        await expect(userService.createUser(userData)).rejects.toThrow('Username already exists.');
      });
  });

  describe('findUserByEmail', () => {
    it('should return a user if email is found', async () => {
      const mockUser = { id: 'cuid1', email: 'test@example.com', password_hash: 'hash' };
      promisePool.query.mockResolvedValueOnce([[mockUser]]);

      const result = await userService.findUserByEmail('test@example.com');
      expect(promisePool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE email = ?', ['test@example.com']);
      expect(result).toEqual(mockUser);
    });

    it('should return null if email is not found', async () => {
      promisePool.query.mockResolvedValueOnce([[]]); // No user found

      const result = await userService.findUserByEmail('notfound@example.com');
      expect(result).toBeNull();
    });

    it('should throw an error if email is not provided', async () => {
        await expect(userService.findUserByEmail(null)).rejects.toThrow('Email is required to find a user.');
    });
  });

  describe('findUserById', () => {
    it('should return a user (without password_hash) if ID is found', async () => {
      const mockUser = { id: 'cuid1', username: 'test', email: 'test@example.com', role: 'agent' };
      promisePool.query.mockResolvedValueOnce([[mockUser]]);

      const result = await userService.findUserById('cuid1');
      expect(promisePool.query).toHaveBeenCalledWith('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?', ['cuid1']);
      expect(result).toEqual(mockUser);
    });

    it('should return null if ID is not found', async () => {
      promisePool.query.mockResolvedValueOnce([[]]);

      const result = await userService.findUserById('cuid_not_found');
      expect(result).toBeNull();
    });

    it('should throw an error if ID is not provided', async () => {
        await expect(userService.findUserById(null)).rejects.toThrow('User ID is required.');
    });
  });

  describe('validatePassword', () => {
    it('should return true if passwords match', async () => {
      bcrypt.compare.mockResolvedValue(true);
      const result = await userService.validatePassword('password123', 'hashedpassword');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(result).toBe(true);
    });

    it('should return false if passwords do not match', async () => {
      bcrypt.compare.mockResolvedValue(false);
      const result = await userService.validatePassword('wrongpassword', 'hashedpassword');
      expect(result).toBe(false);
    });

    it('should return false if inputPassword is not provided', async () => {
        const result = await userService.validatePassword(null, 'hashedpassword');
        expect(result).toBe(false);
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return false if hashedPassword is not provided', async () => {
        const result = await userService.validatePassword('password123', null);
        expect(result).toBe(false);
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });
});
