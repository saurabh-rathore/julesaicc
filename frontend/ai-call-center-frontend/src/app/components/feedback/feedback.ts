import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FeedbackService, Feedback, FeedbackInput } from '../../services/feedback.service'; // Adjust path

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback.html',
  styleUrls: ['./feedback.scss'] // Corrected from styleUrl
})
export class FeedbackComponent implements OnInit, OnChanges { // Changed class name
  @Input() callId!: string; // Expect callId to be provided

  feedbackForm: FormGroup;
  existingFeedback: Feedback | null = null;
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private feedbackService: FeedbackService
  ) {
    this.feedbackForm = this.fb.group({
      rating: [null, [Validators.required, Validators.min(1), Validators.max(5)]],
      comments: [''],
      customer_expressed_satisfaction: [null] // boolean or null
    });
  }

  ngOnInit(): void {
    if (this.callId) {
      this.loadExistingFeedback();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['callId'] && !changes['callId'].firstChange) {
      this.loadExistingFeedback();
    }
  }

  loadExistingFeedback(): void {
    if (!this.callId) return;
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.feedbackService.getFeedbackForCall(this.callId).subscribe({
      next: (feedback) => {
        this.isLoading = false;
        if (feedback) {
          this.existingFeedback = feedback;
          this.feedbackForm.patchValue({
            rating: feedback.rating,
            comments: feedback.comments || '',
            customer_expressed_satisfaction: feedback.customer_expressed_satisfaction
          });
        } else {
          this.existingFeedback = null;
          this.feedbackForm.reset({ rating: null, comments: '', customer_expressed_satisfaction: null });
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = `Failed to load existing feedback: ${err.message}`;
        console.error('Error loading feedback:', err);
      }
    });
  }

  onSubmit(): void {
    if (this.feedbackForm.invalid) {
      this.errorMessage = 'Please provide a valid rating (1-5).';
      // Mark all fields as touched to show validation errors
      Object.values(this.feedbackForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }

    if (!this.callId) {
        this.errorMessage = 'Call ID is missing, cannot submit feedback.';
        return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    const feedbackData: FeedbackInput = {
      call_id: this.callId,
      rating: this.feedbackForm.value.rating,
      comments: this.feedbackForm.value.comments || null, // Send null if empty
      customer_expressed_satisfaction: this.feedbackForm.value.customer_expressed_satisfaction
    };

    if (feedbackData.customer_expressed_satisfaction === null || feedbackData.customer_expressed_satisfaction === undefined) {
        // Ensure we don't send `null` if the control was reset and not touched, backend might expect boolean or not present
        // Depending on backend, sending `undefined` or omitting the field might be better than `null` if it's truly optional.
        // For now, let's ensure it's explicitly null if not set by user.
        // The DB schema allows NULL for this boolean.
    }


    this.feedbackService.submitFeedback(feedbackData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = this.existingFeedback
            ? 'Feedback updated successfully!'
            : 'Feedback submitted successfully!';
        this.existingFeedback = response; // Update with the response from server (which includes id, collected_at)
         this.feedbackForm.patchValue({ // Repatch to ensure form reflects saved state, e.g. if backend modifies data
            rating: response.rating,
            comments: response.comments || '',
            customer_expressed_satisfaction: response.customer_expressed_satisfaction
          });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = `Failed to submit feedback: ${err.message}`;
        console.error('Error submitting feedback:', err);
      }
    });
  }
}
