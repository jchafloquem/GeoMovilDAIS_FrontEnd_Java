import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkyplotPage } from './skyplot.page';

describe('SkyplotPage', () => {
  let component: SkyplotPage;
  let fixture: ComponentFixture<SkyplotPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SkyplotPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
