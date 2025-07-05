import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login'; // Will use LoginComponent class name
import { DashboardComponent } from './components/dashboard/dashboard'; // Will use DashboardComponent class name
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent, // Class name is LoginComponent now
  },
  {
    path: 'dashboard',
    component: DashboardComponent, // Class name is DashboardComponent now
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: '/dashboard', // Or '/login' if you prefer default to login
    pathMatch: 'full',
  },
  {
    path: '**', // Wildcard route for a 404 page
    redirectTo: '/dashboard', // Or a dedicated 404 component
    // loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent)
  },
];
