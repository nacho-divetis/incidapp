import { cva, type VariantProps } from 'class-variance-authority';
import {
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleX,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Funnel,
  History,
  Inbox,
  Info,
  LayoutDashboard,
  List,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { SVGAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Catálogo de iconos de la aplicación (`lucide-react`, licencia ISC). Se importan uno a uno para que
 * el build solo incluya los que se usan. Para un icono nuevo, se añade aquí con un nombre genérico
 * (qué representa, no dónde se usa).
 */
const icons = {
  'arrow-left': ArrowLeft,
  bell: Bell,
  building: Building2,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'circle-check': CircleCheck,
  'circle-x': CircleX,
  clock: Clock,
  download: Download,
  'external-link': ExternalLink,
  eye: Eye,
  'file-text': FileText,
  filter: Funnel,
  history: History,
  inbox: Inbox,
  info: Info,
  dashboard: LayoutDashboard,
  list: List,
  'log-in': LogIn,
  'log-out': LogOut,
  menu: Menu,
  message: MessageSquare,
  paperclip: Paperclip,
  pencil: Pencil,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  trash: Trash2,
  warning: TriangleAlert,
  upload: Upload,
  user: User,
  users: Users,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

/** Nombres de todos los iconos disponibles (para stories y controles). */
export const iconNames = Object.keys(icons) as IconName[];

export const iconVariants = cva('shrink-0', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
    },
  },
  defaultVariants: { size: 'md' },
});

export interface IconProps
  extends Omit<SVGAttributes<SVGSVGElement>, 'name'>, VariantProps<typeof iconVariants> {
  /** Icono del catálogo. */
  name: IconName;
  /**
   * Texto accesible. Si el icono transmite información por sí solo, se le da `label` y se anuncia
   * como imagen; si acompaña a un texto, se omite y queda oculto a los lectores de pantalla.
   */
  label?: string;
}

/** Icono SVG del catálogo, del color del texto (`currentColor`). Decorativo salvo que reciba `label`. */
export function Icon({ name, size, label, className, ...props }: IconProps) {
  const LucideComponent = icons[name];
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const);
  return (
    <LucideComponent
      focusable="false"
      className={cn(iconVariants({ size }), className)}
      {...a11y}
      {...props}
    />
  );
}
