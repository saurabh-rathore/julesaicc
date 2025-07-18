import { Component, OnInit } from '@angular/core';
import { Chart, ChartConfiguration, ChartType } from 'chart.js';
import { AnalyticsService } from '../../../services/analytics.service';

@Component({
  selector: 'app-call-volume-chart',
  templateUrl: './call-volume-chart.html',
  styleUrls: ['./call-volume-chart.scss']
})
export class CallVolumeChartComponent implements OnInit {
  public callVolumeChart: Chart;

  constructor(private analyticsService: AnalyticsService) { }

  ngOnInit(): void {
    this.analyticsService.getCallVolume().subscribe(data => {
      const chartData = {
        labels: data.map(d => d.hour),
        datasets: [{
          label: 'Call Volume by Hour',
          data: data.map(d => d.call_count),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      };

      const chartOptions: ChartConfiguration['options'] = {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      };

      this.callVolumeChart = new Chart('callVolumeChart', {
        type: 'bar',
        data: chartData,
        options: chartOptions
      });
    });
  }
}
