import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LegendCounts {
  complete: number;
  pending: number;
  draft: number;
}

@Injectable({
  providedIn: 'root'
})
export class LegendDataService {
  private legendCounts = new BehaviorSubject<LegendCounts>({ complete: 0, pending: 0, draft: 0 });
  legendCounts$ = this.legendCounts.asObservable();

  updateCounts(counts: LegendCounts) {
    this.legendCounts.next(counts);
  }
}

