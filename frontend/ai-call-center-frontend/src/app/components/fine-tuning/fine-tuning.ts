import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FineTuningService } from '../../services/fine-tuning.service';

@Component({
  selector: 'app-fine-tuning',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fine-tuning.html',
  styleUrls: ['./fine-tuning.scss'] // Corrected
})
export class FineTuningComponent { // Renamed class
  constructor() { }
}
