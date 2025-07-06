import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Call, Transcript, CallService } from '../../services/call.service'; // Adjust path as needed
import { ActivatedRoute } from '@angular/router'; // If fetching by ID from route params

@Component({
  selector: 'app-call-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-detail.html',
  styleUrls: ['./call-detail.scss'] // Corrected from styleUrl
})
export class CallDetailComponent implements OnInit { // Changed class name
  @Input() callId?: string; // Allow passing callId as input, e.g., for modal

  call: Call | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private callService: CallService,
    private route: ActivatedRoute // Inject ActivatedRoute if you plan to get ID from URL
  ) {}

  ngOnInit(): void {
    let idToLoad: string | null = null;
    if (this.callId) {
      idToLoad = this.callId;
    } else {
      // If not passed as input, try to get from route params
      // This requires setting up a route like '/calls/:id'
      idToLoad = this.route.snapshot.paramMap.get('id');
    }

    if (idToLoad) {
      this.loadCallDetails(idToLoad);
    } else {
      this.errorMessage = "No Call ID provided.";
    }
  }

  loadCallDetails(id: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.callService.getCallById(id).subscribe({
      next: (data) => {
        this.call = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.message || `Failed to load details for call ${id}.`;
        this.isLoading = false;
        console.error(`Error loading call details for ${id}:`, err);
      }
    });
  }

  formatDuration(startTime: Date, endTime?: Date): string {
    if (!endTime) return 'Ongoing';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationSeconds = Math.round((end - start) / 1000);
    if (isNaN(durationSeconds) || durationSeconds < 0) return 'N/A';

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    return `${hours > 0 ? hours + 'h ' : ''}${minutes > 0 ? minutes + 'm ' : ''}${seconds}s`;
  }
}
