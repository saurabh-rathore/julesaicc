import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CallService, Call, PaginatedCallsResponse } from '../../services/call.service'; // Adjust path as needed
import { RouterModule } from '@angular/router'; // For potential navigation to call details

@Component({
  selector: 'app-call-logs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './call-logs.html',
  styleUrls: ['./call-logs.scss'] // Corrected from styleUrl
})
export class CallLogsComponent implements OnInit { // Changed class name
  callsResponse: PaginatedCallsResponse | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;

  // Pagination and filtering parameters
  currentPage: number = 1;
  itemsPerPage: number = 10;
  // Add other filter properties here if needed (e.g., status, date range)

  constructor(private callService: CallService, private router: Router) {} // Inject Router

  ngOnInit(): void {
    this.loadCalls();
  }

  loadCalls(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.callService.getCalls(this.currentPage, this.itemsPerPage) // Add other filters as needed
      .subscribe({
        next: (response) => {
          this.callsResponse = response;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = err.message || 'Failed to load call logs.';
          this.isLoading = false;
          console.error('Error loading call logs:', err);
        }
      });
  }

  // Basic pagination handlers (can be expanded)
  nextPage(): void {
    if (this.callsResponse && this.currentPage < this.callsResponse.pagination.totalPages) {
      this.currentPage++;
      this.loadCalls();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadCalls();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && this.callsResponse && page <= this.callsResponse.pagination.totalPages) {
      this.currentPage = page;
      this.loadCalls();
    }
  }

  // Helper to generate page numbers for pagination UI
  getPages(): number[] {
    if (!this.callsResponse || this.callsResponse.pagination.totalPages <= 1) {
      return [];
    }
    // Simple array for now, can be made more sophisticated (e.g., with ellipses for many pages)
    return Array(this.callsResponse.pagination.totalPages).fill(0).map((x, i) => i + 1);
  }

  viewCallDetails(callId: string): void {
    // For now, just log to console. Later, this will navigate to a detail page or open a modal.
    // console.log('View details for call ID:', callId);
    this.router.navigate(['/calls', callId]);
  }
}
