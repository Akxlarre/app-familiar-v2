import { ApplicationConfig, ErrorHandler, LOCALE_ID, importProvidersFrom } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import localeEs from "@angular/common/locales/es";

// Angular NO trae los datos de locale cargados: usar `| date: ... : 'es'` sin
// registrarlo lanza NG0701 en cada render. Se registra una sola vez, acá.
registerLocaleData(localeEs);
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from "@angular/router";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { providePrimeNG } from "primeng/config";
import Aura from "@primeng/themes/aura";
import { MessageService, ConfirmationService } from "primeng/api";
import {
  LucideAngularModule,
  // ── Boilerplate (dashboard, kpi-card, sidebar, alert-card) ──
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle,
  ChevronRight,
  Download,
  LayoutDashboard,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  // ── Shell support (topbar, login, mobile drawer) ──
  Bell,
  LogOut,
  Menu,
  Search,
  X,
  // ── Acciones comunes ──
  Check,
  Edit,
  Info,
  Trash2,
  // ── Navegación ──
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Home,
  Layers,
  // ── Contenido ──
  Calendar,
  Clock,
  FileText,
  FolderOpen,
  Image,
  Upload,
  // ── Acciones extendidas ──
  Copy,
  Eye,
  EyeOff,
  Filter,
  MoreHorizontal,
  MoreVertical,
  RefreshCw,
  Save,
  Share2,
  // ── Comunicación ──
  Mail,
  MessageCircle,
  Send,
  // ── Estado ──
  Ban,
  Circle,
  HelpCircle,
  Loader,
  ShieldCheck,
  Star,
  Tag,
  XCircle,
  // ── Tema ──
  Moon,
  Sun,
} from "lucide-angular";

import { routes } from "./app.routes";
import { provideCoreAuth } from "@core/auth/provide-core-auth";
import { GlobalErrorHandler } from "@core/errors/global-error-handler";

/**
 * Configuración principal de la aplicación.
 *
 * provideCoreAuth() ya incluye provideHttpClient(withInterceptors([authInterceptor])).
 * NO añadas provideHttpClient() por separado o se duplicará.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: ".fake-dark-mode",
          cssLayer: {
            name: "primeng",
            order: "tailwind-base, primeng, tailwind-utilities",
          },
        },
      },
    }),
    provideCoreAuth(),
    { provide: LOCALE_ID, useValue: "es" },
    // Atrapa excepciones no manejadas y las muestra saneadas en un toast,
    // en vez de dejar la app congelada sin señal para el usuario.
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    MessageService,
    ConfirmationService,
    /**
     * Lucide Icons — Set curado SaaS (~48 íconos).
     *
     * Incluye los íconos del boilerplate + un set genérico para features SaaS.
     * Para añadir más: importar de 'lucide-angular' y agregar al objeto.
     * Referencia: https://lucide.dev/icons
     * Guía de iconos del DS: skills/design-system/SKILL.md
     */
    importProvidersFrom(
      LucideAngularModule.pick({
        // Boilerplate (dashboard, kpi-card, sidebar, alert-card)
        Activity,
        AlertCircle,
        AlertTriangle,
        ArrowRight,
        BarChart2,
        CheckCircle,
        ChevronRight,
        Download,
        LayoutDashboard,
        Plus,
        Settings,
        TrendingDown,
        TrendingUp,
        User,
        Users,
        // Shell support
        Bell,
        LogOut,
        Menu,
        Search,
        X,
        // Acciones comunes
        Check,
        Edit,
        Info,
        Trash2,
        // Navegación
        ArrowLeft,
        ChevronDown,
        ChevronLeft,
        ChevronUp,
        Home,
        Layers,
        // Contenido
        Calendar,
        Clock,
        FileText,
        FolderOpen,
        Image,
        Upload,
        // Acciones extendidas
        Copy,
        Eye,
        EyeOff,
        Filter,
        MoreHorizontal,
        MoreVertical,
        RefreshCw,
        Save,
        Share2,
        // Comunicación
        Mail,
        MessageCircle,
        Send,
        // Estado
        Ban,
        Circle,
        HelpCircle,
        Loader,
        ShieldCheck,
        Star,
        Tag,
        XCircle,
        // Tema
        Moon,
        Sun,
      }),
    ),
  ],
};
