import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdvertisementsDetails } from './advertisements-details';

describe('AdvertisementsDetails', () => {
  let component: AdvertisementsDetails;
  let fixture: ComponentFixture<AdvertisementsDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdvertisementsDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdvertisementsDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
