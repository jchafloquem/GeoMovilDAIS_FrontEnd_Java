import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FotosTabPage } from './fotos-tab.page';

describe('FotosTabPage', () => {
  let component: FotosTabPage;
  let fixture: ComponentFixture<FotosTabPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FotosTabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
