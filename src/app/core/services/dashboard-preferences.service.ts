import { Injectable, signal } from '@angular/core';

export type DashboardTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class DashboardPreferencesService {
  private readonly themeKey = 'sc_dashboard_theme';
  private readonly sidebarKey = 'sc_dashboard_sidebar_open';
  private readonly reducedMotionKey = 'sc_dashboard_reduced_motion';

  readonly theme = signal<DashboardTheme>(this.readTheme());
  readonly sidebarDefaultOpen = signal<boolean>(this.readBoolean(this.sidebarKey, true));
  readonly reducedMotion = signal<boolean>(this.readBoolean(this.reducedMotionKey, false));
  private themeSwapTimer?: ReturnType<typeof setTimeout>;
  private themeFinishTimer?: ReturnType<typeof setTimeout>;

  isDarkTheme(): boolean {
    return this.theme() === 'dark';
  }

  setTheme(theme: DashboardTheme): void {
    if (theme === this.theme()) return;

    this.clearThemeTimers();

    const applyTheme = () => {
      this.theme.set(theme);
      this.write(this.themeKey, theme);
    };

    if (this.reducedMotion() || typeof document === 'undefined') {
      this.clearThemeTransitionClasses();
      applyTheme();
      return;
    }

    const root = document.documentElement;
    this.clearThemeTransitionClasses();
    root.classList.add(
      'sc-theme-transitioning',
      theme === 'dark' ? 'sc-theme-transitioning--dark' : 'sc-theme-transitioning--light',
    );

    this.themeSwapTimer = setTimeout(applyTheme, 150);
    this.themeFinishTimer = setTimeout(() => this.clearThemeTransitionClasses(), 460);
  }

  setSidebarDefaultOpen(open: boolean): void {
    this.sidebarDefaultOpen.set(open);
    this.write(this.sidebarKey, String(open));
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion.set(enabled);
    this.write(this.reducedMotionKey, String(enabled));
  }

  reset(): void {
    this.setTheme('light');
    this.setSidebarDefaultOpen(true);
    this.setReducedMotion(false);
  }

  private readTheme(): DashboardTheme {
    const stored = this.read(this.themeKey);
    return stored === 'dark' ? 'dark' : 'light';
  }

  private readBoolean(key: string, fallback: boolean): boolean {
    const stored = this.read(key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return fallback;
  }

  private read(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  private write(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }

  private clearThemeTimers(): void {
    if (this.themeSwapTimer) clearTimeout(this.themeSwapTimer);
    if (this.themeFinishTimer) clearTimeout(this.themeFinishTimer);
    this.themeSwapTimer = undefined;
    this.themeFinishTimer = undefined;
  }

  private clearThemeTransitionClasses(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove(
      'sc-theme-transitioning',
      'sc-theme-transitioning--dark',
      'sc-theme-transitioning--light',
    );
  }
}
