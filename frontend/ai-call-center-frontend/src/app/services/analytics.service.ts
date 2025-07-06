import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// TODO: Move to environment configuration
const API_BASE_URL = 'http://localhost:3000/api';

export interface CallStats {
  totalCalls: number;
  averageDurationSeconds: number;
  totalEscalations: number;
}

export interface ResolutionRates {
  aiResolvedCount: number;
  humanResolvedCount: number;
  escalatedCount: number;
  totalRelevantCallsForResolutionRate: number;
}

export interface FeedbackSummary {
  averageRating: number;
  totalFeedbackEntries: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private analyticsUrl = `${API_BASE_URL}/analytics`;

  constructor(private http: HttpClient) { }

  getCallStats(): Observable<CallStats> {
    return this.http.get<CallStats>(`${this.analyticsUrl}/stats`)
      .pipe(catchError(this.handleError));
  }

  getResolutionRates(): Observable<ResolutionRates> {
    return this.http.get<ResolutionRates>(`${this.analyticsUrl}/resolution-rates`)
      .pipe(catchError(this.handleError));
  }

  getFeedbackSummary(): Observable<FeedbackSummary> {
    return this.http.get<FeedbackSummary>(`${this.analyticsUrl}/feedback-summary`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred with the analytics service!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Client-side error: ${error.error.message}`;
    } else {
      // Server-side errors
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.statusText && error.status) {
        errorMessage = `Server error (status ${error.status}): ${error.statusText}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
    }
    console.error('AnalyticsService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
