import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LegendCounts, LegendDataService } from 'src/app/services/legend-data.service';

@Component({
  selector: 'app-legend',
  templateUrl: './legend.page.html',
  styleUrls: ['./legend.page.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class LegendPage implements OnInit, OnDestroy {
  public legendData: LegendCounts | null = null;
  private subscription: Subscription | null = null;

  public legendItems = [
    { color: '#2dd36f', label: 'Completo', key: 'complete' as keyof LegendCounts },
    { color: '#ffc409', label: 'Pendiente', key: 'pending' as keyof LegendCounts },
    { color: '#eb445a', label: 'Borrador', key: 'draft' as keyof LegendCounts }
  ];

  constructor(private legendDataService: LegendDataService) {}

  ngOnInit() {
    this.subscription = this.legendDataService.legendCounts$.subscribe(counts => {
      this.legendData = counts;
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}