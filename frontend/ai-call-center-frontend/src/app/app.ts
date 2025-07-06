import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common'; // For *ngIf
import { AuthService } from './services/auth.service';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true, // Ensure it's standalone
  imports: [RouterOutlet, RouterLink, CommonModule], // Add RouterLink and CommonModule
  templateUrl: './app.html',
  styleUrl: './app.scss' // Keeping styleUrl as per original generation
})
export class App implements OnInit { // Keep class name App
  title = 'AI Call Center Admin'; // Changed title, made public for template
  isUserLoggedIn: boolean = false;

  constructor(
    public authService: AuthService, // Made public for template access via isLoggedIn getter
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated.subscribe(isAuth => {
      this.isUserLoggedIn = isAuth;
    });

    // Optional: Handle browser back/forward navigation correctly with auth state
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.authService.isAuthenticated.pipe(take(1)).subscribe(isAuth => this.isUserLoggedIn = isAuth);
    });
  }

  // Getter for template to check login status
  get isLoggedIn(): boolean {
    return this.isUserLoggedIn;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  get currentYear(): number {
    return new Date().getFullYear();
  }
}
