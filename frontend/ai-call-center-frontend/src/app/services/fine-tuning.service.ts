import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

// Define backend API URL - should ideally come from environment config
const API_URL = 'http://localhost:3000/api/fine-tuning';

@Injectable({
  providedIn: 'root'
})
export class FineTuningService {

  constructor(private http: HttpClient) { }

  uploadFile(file: File): Observable<HttpEvent<any>> {
    const formData: FormData = new FormData();
    formData.append('trainingFile', file, file.name);

    const req = new HttpRequest('POST', `${API_URL}/upload`, formData, {
      reportProgress: true,
      responseType: 'json'
    });

    return this.http.request(req);
  }
}
