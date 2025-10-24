import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfesionalTabPage } from './profesional-tab.page';

describe('ProfesionalTabPage', () => {
  let component: ProfesionalTabPage;
  let fixture: ComponentFixture<ProfesionalTabPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProfesionalTabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
