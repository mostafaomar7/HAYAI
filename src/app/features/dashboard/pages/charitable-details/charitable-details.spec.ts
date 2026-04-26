import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CharitableDetails } from './charitable-details';

describe('CharitableDetails', () => {
  let component: CharitableDetails;
  let fixture: ComponentFixture<CharitableDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharitableDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CharitableDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
