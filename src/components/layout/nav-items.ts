import {
  Clapperboard,
  Film,
  Home,
  Image,
  LayoutList,
  Music,
  Radio,
  Settings,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Rutas de la aplicación cubiertas por el App Shell (Fase 1). */
export type AppRoute =
  | "/"
  | "/projects"
  | "/songs"
  | "/bible"
  | "/media"
  | "/presets"
  | "/live"
  | "/outputs"
  | "/settings";

export interface NavItem {
  readonly title: string;
  readonly to: AppRoute;
  readonly icon: LucideIcon;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Home", to: "/", icon: Home },
      { title: "Projects", to: "/projects", icon: LayoutList },
      { title: "Songs", to: "/songs", icon: Music },
      { title: "Bible", to: "/bible", icon: BookOpen },
      { title: "Media", to: "/media", icon: Image },
      { title: "Presets", to: "/presets", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Producción",
    items: [
      { title: "Live", to: "/live", icon: Radio },
      { title: "Outputs", to: "/outputs", icon: Clapperboard },
    ],
  },
  {
    label: "Sistema",
    items: [{ title: "Settings", to: "/settings", icon: Settings }],
  },
] as const;

/** Icono de marca del workspace. */
export const BRAND_ICON: LucideIcon = Film;
