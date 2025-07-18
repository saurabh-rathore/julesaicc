import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Feedback {
  id: number;
  call_id: string;
  rating: number;
  comments?: string;
  customer_expressed_satisfaction?: boolean;
  collected_at?: Date;
}

export interface PaginatedFeedbackResponse {
  feedback: Feedback[];
  pagination: {
    page: number;
    pageSize: number;
    totalFeedback: number;
    totalPages: number;
  };
}

// Use a separate type for input to allow for optional fields on creation
export type FeedbackInput = Omit<Feedback, 'id' | 'collected_at'>;


@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private apiUrl = `${environment.apiUrl}/feedback`;

  constructor(private http: HttpClient) { }

  /**
   * Submits new feedback for a call.
   * @param feedbackData - The feedback data to submit.
   */
  submitFeedback(feedbackData: FeedbackInput): Observable<Feedback> {
    return this.http.post<Feedback>(this.apiUrl, feedbackData);
  }

  /**
   * Retrieves feedback for a specific call.
   * @param callId - The ID of the call.
   */
  getFeedbackForCall(callId: string): Observable<Feedback> {
    return this.http.get<Feedback>(`${this.apiUrl}/call/${callId}`);
  }

  /**
   * Updates existing feedback.
   * @param feedbackId - The ID of the feedback entry to update.
   * @param feedbackData - The updated feedback data.
   */
  updateFeedback(feedbackId: number, feedbackData: Partial<FeedbackInput>): Observable<Feedback> {
    return this.http.put<Feedback>(`${this.apiUrl}/${feedbackId}`, feedbackData);
  }

  /**
   * Retrieves all feedback entries (paginated).
   * @param page - The page number to retrieve.
   * @param limit - The number of entries per page.
   */
  getAllFeedback(page: number = 1, limit: number = 10): Observable<PaginatedFeedbackResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedFeedbackResponse>(this.apiUrl, { params });
  }
}
