import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  CanActivateFn,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check authentication status using the BehaviorSubject's current value or observable
  // Using isAuthenticated observable for reactivity is generally better.
  return authService.isAuthenticated.pipe(
    take(1), // Take the first value and complete
    map(isAuthenticated => {
      if (isAuthenticated) {
        // Optional: Check for token expiration if not handled by an interceptor or AuthService itself
        // if (authService.isTokenExpired()) { // Assuming you have such a method
        //   console.log('AuthGuard: Token expired, logging out.');
        //   authService.logout();
        //   router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        //   return false;
        // }
        return true; // User is authenticated and token is not considered expired here
      } else {
        // Not authenticated, redirect to login page with the return url
        console.log('AuthGuard: User not authenticated. Redirecting to login.');
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
    })
  );
};

// If you were using class-based guards (older Angular versions or by choice):
/*
@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.isAuthenticated.pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          // if (this.authService.isTokenExpired()) { // Assuming method exists
          //   this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          //   return false;
          // }
          return true;
        }
        this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      })
    );
  }
}
*/
