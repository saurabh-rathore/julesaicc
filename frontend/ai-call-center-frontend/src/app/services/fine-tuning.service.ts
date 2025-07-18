import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FineTuningService {
  private apiUrl = `${environment.apiUrl}/fine-tuning`;

  constructor(private http: HttpClient) { }

  startFineTuning(model: string): Observable<any> {
    return this.http.post(this.apiUrl, { model });
  }
}
