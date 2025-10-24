import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductorTabPage } from './productor-tab.page';

describe('ProductorTabPage', () => {
  let component: ProductorTabPage;
  let fixture: ComponentFixture<ProductorTabPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProductorTabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
