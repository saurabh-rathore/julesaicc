import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpEventType } from '@angular/common/http';
import { FineTuningService } from '../../services/fine-tuning.service';
import { SettingsService, NluMode } from '../../services/settings.service';

@Component({
  selector: 'app-fine-tuning',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './fine-tuning.html',
  styleUrls: ['./fine-tuning.scss']
})
export class FineTuningComponent implements OnInit {
  // File Upload Properties
  selectedFile: File | null = null;
  uploadProgress = 0;
  message: string | null = null;
  isLoading = false;
  isError = false;

  // NLU Settings Properties
  currentNluMode: 'llm' | 'rasa' | null = null;
  settingsMessage: string | null = null;

  constructor(
    private fineTuningService: FineTuningService,
    private settingsService: SettingsService
  ) { }

  ngOnInit(): void {
    this.loadNluMode();
  }

  loadNluMode(): void {
    this.settingsService.getNluMode().subscribe({
      next: (data: NluMode) => {
        this.currentNluMode = data.mode;
      },
      error: (err) => {
        console.error('Failed to load NLU mode', err);
        this.settingsMessage = 'Could not load NLU mode setting.';
      }
    });
  }

  onNluModeChange(mode: 'llm' | 'rasa'): void {
    this.settingsMessage = 'Saving...';
    this.settingsService.setNluMode(mode).subscribe({
      next: () => {
        this.currentNluMode = mode;
        this.settingsMessage = `NLU mode successfully set to ${mode.toUpperCase()}.`;
        setTimeout(() => this.settingsMessage = null, 3000);
      },
      error: (err) => {
        console.error('Failed to save NLU mode', err);
        this.settingsMessage = 'Failed to save setting. Please try again.';
      }
    });
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    if (fileList) {
      this.selectedFile = fileList[0];
      this.message = null;
      this.uploadProgress = 0;
      this.isError = false;
    }
  }

  onUpload(): void {
    if (!this.selectedFile) {
      this.message = 'Please select a file first.';
      this.isError = true;
      return;
    }

    this.isLoading = true;
    this.message = null;
    this.uploadProgress = 0;

    this.fineTuningService.uploadFile(this.selectedFile).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round(100 * event.loaded / (event.total || 1));
        } else if (event.type === HttpEventType.Response) {
          this.message = event.body.message;
          this.isLoading = false;
          this.isError = false;
          this.selectedFile = null;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.uploadProgress = 0;
        this.message = err.error?.message || 'File upload failed. Please try again.';
        this.isError = true;
        console.error('Upload error:', err);
      }
    });
  }
}
