import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LegendPage } from './legend.page';

describe('LegendPage', () => {
  let component: LegendPage;
  let fixture: ComponentFixture<LegendPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LegendPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
