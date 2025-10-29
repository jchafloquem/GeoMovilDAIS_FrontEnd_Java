import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SendEmailPage } from './send-email.page';

describe('SendEmailPage', () => {
  let component: SendEmailPage;
  let fixture: ComponentFixture<SendEmailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SendEmailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
