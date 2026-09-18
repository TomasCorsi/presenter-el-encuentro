/**
 * Declaraciones mínimas de la Window Management API (Chromium). Los tipos DOM
 * de TypeScript todavía no la incluyen y no queremos una dependencia solo para
 * esto ni `any` general.
 */
export {};

declare global {
  interface ScreenDetailed extends Screen, EventTarget {
    readonly availLeft: number;
    readonly availTop: number;
    readonly left: number;
    readonly top: number;
    readonly isPrimary: boolean;
    readonly isInternal: boolean;
    readonly label: string;
    readonly devicePixelRatio: number;
  }

  interface ScreenDetails extends EventTarget {
    readonly screens: ReadonlyArray<ScreenDetailed>;
    readonly currentScreen: ScreenDetailed;
  }

  interface Window {
    getScreenDetails?: () => Promise<ScreenDetails>;
  }

  interface Screen {
    readonly isExtended?: boolean;
  }

  interface FullscreenOptions {
    screen?: ScreenDetailed;
  }
}
