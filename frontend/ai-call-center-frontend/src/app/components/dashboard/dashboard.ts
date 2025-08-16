import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, AuthResponse } from '../../services/auth.service';
import { AnalyticsService, CallStats, ResolutionRates, FeedbackSummary } from '../../services/analytics.service';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  currentUser: AuthResponse | null = null;
  callStats$: Observable<CallStats | null> | undefined;
  resolutionRates$: Observable<ResolutionRates | null> | undefined;
  feedbackSummary$: Observable<FeedbackSummary | null> | undefined;

  isLoadingStats = true;
  isLoadingRates = true;
  isLoadingFeedback = true;

  statsError: string | null = null;
  ratesError: string | null = null;
  feedbackError: string | null = null;


  constructor(
    private authService: AuthService,
    private router: Router,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
    this.loadAnalyticsData();
  }

  loadAnalyticsData(): void {
    this.isLoadingStats = true;
    this.isLoadingRates = true;
    this.isLoadingFeedback = true;
    this.statsError = null;
    this.ratesError = null;
    this.feedbackError = null;

    this.callStats$ = this.analyticsService.getCallStats().pipe(
      catchError(err => {
        this.statsError = err.message || 'Failed to load call statistics.';
        this.isLoadingStats = false;
        return of(null);
      }),
      tap(() => this.isLoadingStats = false)
    );

    this.resolutionRates$ = this.analyticsService.getResolutionRates().pipe(
      catchError(err => {
        this.ratesError = err.message || 'Failed to load resolution rates.';
        this.isLoadingRates = false;
        return of(null);
      }),
      tap(() => this.isLoadingRates = false)
    );

    this.feedbackSummary$ = this.analyticsService.getFeedbackSummary().pipe(
      catchError(err => {
        this.feedbackError = err.message || 'Failed to load feedback summary.';
        this.isLoadingFeedback = false;
        return of(null);
      }),
      tap(() => this.isLoadingFeedback = false)
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
