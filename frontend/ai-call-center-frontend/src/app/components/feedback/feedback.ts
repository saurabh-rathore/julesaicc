import { Component, OnInit } from '@angular/core';
import { FeedbackService, PaginatedFeedbackResponse } from '../../services/feedback.service';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.html',
  styleUrls: ['./feedback.scss'],
})
export class FeedbackComponent implements OnInit {
  feedbackResponse: PaginatedFeedbackResponse | null = null;
  isLoading = true;
  errorMessage: string | null = null;
  currentPage = 1;
  pageSize = 10;

  constructor(private feedbackService: FeedbackService) {}

  ngOnInit(): void {
    this.loadFeedback();
  }

  loadFeedback(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.feedbackService.getAllFeedback(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.feedbackResponse = response;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = `Failed to load feedback: ${err.error?.message || 'Please try again.'}`;
        this.isLoading = false;
      },
    });
  }

  getPages(): number[] {
    if (!this.feedbackResponse) return [];
    const totalPages = this.feedbackResponse.pagination.totalPages;
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadFeedback();
  }

  nextPage(): void {
    if (this.feedbackResponse && this.currentPage < this.feedbackResponse.pagination.totalPages) {
      this.currentPage++;
      this.loadFeedback();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadFeedback();
    }
  }
}
