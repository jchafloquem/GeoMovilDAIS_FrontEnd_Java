import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeometricosTabPage } from './geometricos-tab.page';

describe('GeometricosTabPage', () => {
  let component: GeometricosTabPage;
  let fixture: ComponentFixture<GeometricosTabPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GeometricosTabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
