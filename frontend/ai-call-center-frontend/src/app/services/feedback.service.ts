import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Assuming backend API base URL is consistent
// TODO: Move to environment configuration
const API_BASE_URL = 'http://localhost:3000/api';

export interface Feedback {
  id: string;
  call_id: string;
  rating: number;
  comments?: string;
  customer_expressed_satisfaction?: boolean;
  collected_at: Date;
  // user_id?: string; // If we track who submitted
}

export interface FeedbackInput {
  call_id: string;
  rating: number;
  comments?: string;
  customer_expressed_satisfaction?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private feedbackUrl = `${API_BASE_URL}/feedback`;

  constructor(private http: HttpClient) { }

  /**
   * Submit feedback for a call.
   * This will create new feedback or update existing feedback for the given call_id.
   * @param feedbackData - The feedback data to submit.
   */
  submitFeedback(feedbackData: FeedbackInput): Observable<Feedback> {
    return this.http.post<Feedback>(this.feedbackUrl, feedbackData)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get feedback for a specific call.
   * @param callId - The ID of the call.
   */
  getFeedbackForCall(callId: string): Observable<Feedback | null> {
    return this.http.get<Feedback | null>(`${this.feedbackUrl}/call/${callId}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get all feedback entries.
   * TODO: Implement pagination if needed for admin views.
   */
  getAllFeedback(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(this.feedbackUrl)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred with the feedback service!';
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
    console.error('FeedbackService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
