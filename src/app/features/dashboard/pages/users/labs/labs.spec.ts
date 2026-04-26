import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Labs } from './labs';

describe('Labs', () => {
  let component: Labs;
  let fixture: ComponentFixture<Labs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Labs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Labs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
