import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistertabsPage } from './registertabs.page';

describe('RegistertabsPage', () => {
  let component: RegistertabsPage;
  let fixture: ComponentFixture<RegistertabsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistertabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
