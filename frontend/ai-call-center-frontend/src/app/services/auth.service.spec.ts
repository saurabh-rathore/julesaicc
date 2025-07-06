import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, AuthResponse } from './auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // Import HttpClient

// API_URL is defined in auth.service.ts, we need it for matching requests
const API_URL = 'http://localhost:3000/api/auth';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  const mockAuthResponse: AuthResponse = {
    token: 'mock-jwt-token',
    user: { id: '1', username: 'testuser', email: 'test@example.com', role: 'user' }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jest.fn() } }
      ]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial state', () => {
    it('currentUserValue should be null initially if localStorage is empty', () => {
      expect(service.currentUserValue).toBeNull();
    });

    it('isAuthenticated should be false initially if localStorage is empty', (done) => {
      service.isAuthenticated.subscribe(isAuth => {
        expect(isAuth).toBeFalse();
        done();
      });
    });

    it('should load user from localStorage on initialization', () => {
      localStorage.setItem('currentUser', JSON.stringify(mockAuthResponse));
      // Need to create a new instance to test constructor logic with pre-filled localStorage
      // This is a bit tricky with TestBed.inject for the same service instance.
      // A direct instantiation or a spy on localStorage might be better for this specific constructor test.
      // For simplicity here, we'll test the state *after* a new service would have been created.
      const httpClient = TestBed.inject(HttpClient);
      const newServiceInstance = new AuthService(httpClient); // Manually create with deps

      expect(newServiceInstance.currentUserValue).toEqual(mockAuthResponse);
      newServiceInstance.isAuthenticated.subscribe(isAuth => {
        expect(isAuth).toBeTrue();
      });
    });
  });

  describe('login', () => {
    it('should send a POST request to /login and store user data on success', (done) => {
      const email = 'test@example.com';
      const password = 'password';

      service.login(email, password).subscribe(response => {
        expect(response).toEqual(mockAuthResponse);
        expect(service.currentUserValue).toEqual(mockAuthResponse);
        expect(localStorage.getItem('currentUser')).toEqual(JSON.stringify(mockAuthResponse));
        service.isAuthenticated.subscribe(isAuth => {
          expect(isAuth).toBeTrue();
          done();
        });
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email, password });
      req.flush(mockAuthResponse);
    });

    it('should handle login error', (done) => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const errorResponse = { status: 401, statusText: 'Unauthorized' };
      const errorMessage = 'Invalid credentials. Please try again.';

      service.login(email, password).subscribe({
        next: () => fail('should have failed with an error'),
        error: (err) => {
          expect(err.message).toEqual(errorMessage); // Check the processed error message
          expect(service.currentUserValue).toBeNull();
          expect(localStorage.getItem('currentUser')).toBeNull();
          service.isAuthenticated.subscribe(isAuth => {
            expect(isAuth).toBeFalse();
            done();
          });
        }
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'Invalid credentials.' }, errorResponse); // Simulate error response
    });
  });

  describe('logout', () => {
    it('should clear currentUser, remove from localStorage, and set isAuthenticated to false', () => {
      // First, simulate a login
      localStorage.setItem('currentUser', JSON.stringify(mockAuthResponse));
      // Re-initialize service to pick up from localStorage or manually set subjects
      const httpClient = TestBed.inject(HttpClient);
      const loggedInService = new AuthService(httpClient);

      expect(loggedInService.currentUserValue).toEqual(mockAuthResponse);

      let authState = true;
      loggedInService.isAuthenticated.subscribe(isAuth => authState = isAuth);
      expect(authState).toBeTrue();

      loggedInService.logout();

      expect(loggedInService.currentUserValue).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
      loggedInService.isAuthenticated.subscribe(isAuth => {
         expect(isAuth).toBeFalse();
      });
      // If router was used in logout: expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('getToken', () => {
    it('should return null if no user is logged in', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should return the token if a user is logged in', () => {
      localStorage.setItem('currentUser', JSON.stringify(mockAuthResponse));
      const newServiceInstance = new AuthService(TestBed.inject(HttpClient)); // Re-init to pick up localStorage
      expect(newServiceInstance.getToken()).toBe(mockAuthResponse.token);
    });
  });

  // Placeholder for isTokenExpired, getUserRole etc. if jwt-decode is added
  // describe('getDecodedToken', () => { ... });
  // describe('getUserRole', () => { ... });
  // describe('isTokenExpired', () => { ... });
});
