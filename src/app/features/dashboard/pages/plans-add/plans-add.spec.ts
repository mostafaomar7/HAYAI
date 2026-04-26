import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlansAdd } from './plans-add';

describe('PlansAdd', () => {
  let component: PlansAdd;
  let fixture: ComponentFixture<PlansAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlansAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
