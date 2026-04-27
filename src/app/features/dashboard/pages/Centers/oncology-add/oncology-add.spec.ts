import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OncologyAdd } from './oncology-add';

describe('OncologyAdd', () => {
  let component: OncologyAdd;
  let fixture: ComponentFixture<OncologyAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OncologyAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OncologyAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
