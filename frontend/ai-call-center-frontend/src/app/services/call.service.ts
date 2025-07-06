import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Define backend API URL - should ideally come from environment config
const API_BASE_URL = 'http://localhost:3000/api'; // Assuming backend runs on port 3000

// Interfaces based on schema.sql (can be expanded)
export interface Call {
  id: string;
  customer_phone_number?: string;
  sip_call_id?: string;
  start_time: Date;
  end_time?: Date;
  status: 'initiated' | 'ringing' | 'answered_ai' | 'answered_human' | 'in_progress_ai' | 'in_progress_human' | 'escalated' | 'completed' | 'failed' | 'missed';
  direction: 'inbound' | 'outbound';
  initial_language_preference?: string;
  final_disposition?: string;
  recording_url?: string;
  escalated_to_agent_id?: string;
  created_at: Date;
  updated_at: Date;
  transcripts?: Transcript[]; // Optional, loaded on demand
}

export interface Transcript {
  id: number;
  call_id: string;
  speaker: 'customer' | 'ai' | 'human_agent';
  text: string;
  timestamp_start: number; // decimal as number
  timestamp_end: number;   // decimal as number
  language?: string;
  confidence_score?: number; // decimal as number
  created_at: Date;
}

export interface PaginatedCallsResponse {
  calls: Call[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalCalls: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CallService {

  private callsUrl = `${API_BASE_URL}/calls`;

  constructor(private http: HttpClient) { }

  // Get all calls with pagination and filtering
  getCalls(
    page: number = 1,
    limit: number = 10,
    status?: string,
    startDate?: string,
    endDate?: string,
    sortBy: string = 'start_time',
    order: string = 'DESC'
  ): Observable<PaginatedCallsResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('sortBy', sortBy)
      .set('order', order);

    if (status) {
      params = params.set('status', status);
    }
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }

    return this.http.get<PaginatedCallsResponse>(this.callsUrl, { params })
      .pipe(catchError(this.handleError));
  }

  // Get a single call by ID (includes transcripts)
  getCallById(id: string): Observable<Call> {
    return this.http.get<Call>(`${this.callsUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  // Get transcripts for a specific call
  getCallTranscripts(callId: string): Observable<Transcript[]> {
    return this.http.get<Transcript[]>(`${this.callsUrl}/${callId}/transcripts`)
      .pipe(catchError(this.handleError));
  }

  // Create a call (manual log - for testing or specific use cases)
  createCall(callData: Partial<Call>): Observable<Call> {
    return this.http.post<Call>(this.callsUrl, callData)
      .pipe(catchError(this.handleError));
  }

  // Update a call
  updateCall(id: string, updates: Partial<Call>): Observable<Call> {
    return this.http.put<Call>(`${this.callsUrl}/${id}`, updates)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.statusText) {
        errorMessage = `Server returned code: ${error.status}, error message is: ${error.statusText}`;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
