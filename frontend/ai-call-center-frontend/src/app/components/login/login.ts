import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service'; // Assuming path is correct

@Component({
  selector: 'app-login',
  standalone: true, // Make it standalone
  imports: [
    CommonModule,
    ReactiveFormsModule, // For reactive forms
    RouterLink // For routerLink directive if used in template
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent { // Changed class name to PascalCase convention
  loginForm: FormGroup;
  errorMessage: string | null = null;
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Navigate to dashboard or returnUrl
        // const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate(['/dashboard']); // Simple navigation for now
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Login failed. Please check your credentials.';
        console.error('Login error:', err);
      }
    });
  }
}
