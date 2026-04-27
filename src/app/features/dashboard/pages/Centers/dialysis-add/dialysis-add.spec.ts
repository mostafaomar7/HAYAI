import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialysisAdd } from './dialysis-add';

describe('DialysisAdd', () => {
  let component: DialysisAdd;
  let fixture: ComponentFixture<DialysisAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialysisAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialysisAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
