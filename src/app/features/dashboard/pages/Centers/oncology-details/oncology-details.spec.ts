import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OncologyDetails } from './oncology-details';

describe('OncologyDetails', () => {
  let component: OncologyDetails;
  let fixture: ComponentFixture<OncologyDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OncologyDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OncologyDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
