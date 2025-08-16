import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = 'http://localhost:3000/api/settings';

export interface NluMode {
  mode: 'llm' | 'rasa';
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  constructor(private http: HttpClient) { }

  getNluMode(): Observable<NluMode> {
    return this.http.get<NluMode>(`${API_URL}/nlu-mode`);
  }

  setNluMode(mode: 'llm' | 'rasa'): Observable<any> {
    return this.http.post(`${API_URL}/nlu-mode`, { mode });
  }
}
