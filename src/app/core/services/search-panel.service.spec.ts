import { TestBed } from "@angular/core/testing";
import { SearchPanelService } from "./search-panel.service";

describe("SearchPanelService", () => {
  let service: SearchPanelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchPanelService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should start closed", () => {
    expect(service.isOpen()).toBe(false);
  });

  it("open() should set isOpen to true", () => {
    service.open();
    expect(service.isOpen()).toBe(true);
  });

  it("close() should set isOpen to false after opening", () => {
    service.open();
    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it("toggle() should flip the state each call", () => {
    service.toggle();
    expect(service.isOpen()).toBe(true);
    service.toggle();
    expect(service.isOpen()).toBe(false);
  });
});
