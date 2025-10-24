import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgrariosTabPage } from './agrarios-tab.page';

describe('AgrariosTabPage', () => {
  let component: AgrariosTabPage;
  let fixture: ComponentFixture<AgrariosTabPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AgrariosTabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
