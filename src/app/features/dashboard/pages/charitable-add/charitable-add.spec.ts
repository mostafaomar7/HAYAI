import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CharitableAdd } from './charitable-add';

describe('CharitableAdd', () => {
  let component: CharitableAdd;
  let fixture: ComponentFixture<CharitableAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharitableAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CharitableAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
