import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HyperbaricOxygenDetails } from './hyperbaric-oxygen-details';

describe('HyperbaricOxygenDetails', () => {
  let component: HyperbaricOxygenDetails;
  let fixture: ComponentFixture<HyperbaricOxygenDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HyperbaricOxygenDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HyperbaricOxygenDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
