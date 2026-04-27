import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialysisDetails } from './dialysis-details';

describe('DialysisDetails', () => {
  let component: DialysisDetails;
  let fixture: ComponentFixture<DialysisDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialysisDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialysisDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
