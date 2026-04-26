import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmploymentOffice } from './employment-office';

describe('EmploymentOffice', () => {
  let component: EmploymentOffice;
  let fixture: ComponentFixture<EmploymentOffice>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmploymentOffice]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmploymentOffice);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
