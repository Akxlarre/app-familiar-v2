import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
import { ThemeService } from "./theme.service";
import { GsapAnimationsService } from "./gsap-animations.service";
import { ToastService } from "./toast.service";

describe("ThemeService", () => {
  let service: ThemeService;
  let gsapSpy: { animateThemeChange: ReturnType<typeof vi.fn> };
  let toastSpy: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Ensure clean state before each test
    localStorage.removeItem("app-color-mode");
    document.documentElement.removeAttribute("data-mode");

    gsapSpy = {
      animateThemeChange: vi.fn().mockImplementation((callback) => {
        callback();
        return Promise.resolve();
      }),
    };

    toastSpy = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: GsapAnimationsService, useValue: gsapSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.removeItem("app-color-mode");
    document.documentElement.removeAttribute("data-mode");
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("darkMode should start as false when no preference is saved", () => {
    expect(service.darkMode()).toBe(false);
  });

  it("isThemeTransitioning should start as false", () => {
    expect(service.isThemeTransitioning()).toBe(false);
  });

  it("syncWithSystem should start as false", () => {
    expect(service.syncWithSystem()).toBe(false);
  });

  it("setColorMode('dark') should set darkMode to true", () => {
    service.setColorMode("dark");
    expect(service.darkMode()).toBe(true);
  });

  it("setColorMode('dark') should apply data-mode='dark' to documentElement", () => {
    service.setColorMode("dark");
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
  });

  it("setColorMode('light') after dark should revert darkMode to false", async () => {
    service.setColorMode("dark");
    // Flush the .finally() microtask so isThemeTransitioning resets
    await Promise.resolve();
    service.setColorMode("light");
    expect(service.darkMode()).toBe(false);
  });

  it("setColorMode('light') after dark should remove data-mode attribute", async () => {
    service.setColorMode("dark");
    await Promise.resolve();
    service.setColorMode("light");
    expect(document.documentElement.getAttribute("data-mode")).toBeNull();
  });

  it("setColorMode('system') should set syncWithSystem to true", async () => {
    service.setColorMode("dark");
    await Promise.resolve();
    service.setColorMode("system");
    expect(service.syncWithSystem()).toBe(true);
  });

  it("cycleColorMode() should transition light → dark on first call", () => {
    service.cycleColorMode();
    expect(service.darkMode()).toBe(true);
  });

  it("cycleColorMode() should call animateThemeChange", () => {
    service.cycleColorMode();
    expect(gsapSpy.animateThemeChange).toHaveBeenCalled();
  });

  it("cycleColorMode() while transitioning should be a no-op", () => {
    // Simulate transitioning state
    service["isThemeTransitioning"].set(true);
    service.cycleColorMode();
    expect(gsapSpy.animateThemeChange).not.toHaveBeenCalled();
  });
});
