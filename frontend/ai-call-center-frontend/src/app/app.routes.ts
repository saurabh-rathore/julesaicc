import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { CallLogsComponent } from './components/call-logs/call-logs';
import { CallDetailComponent } from './components/call-detail/call-detail';
import { FineTuningComponent } from './components/fine-tuning/fine-tuning'; // Import FineTuningComponent
import { RegisterComponent } from './components/register/register';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'calls', // Route for the call logs list
    component: CallLogsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'calls/:id', // Route for a single call detail
    component: CallDetailComponent,
    canActivate: [authGuard],
  },
  {
    path: 'fine-tuning',
    component: FineTuningComponent,
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: '/dashboard', // Default to dashboard if authenticated, guard handles unauthenticated
    pathMatch: 'full',
  },
  {
    path: '**', // Wildcard route for a 404 page
    redirectTo: '/dashboard', // Or a dedicated 404 component, or redirect to login/dashboard
  },
];
