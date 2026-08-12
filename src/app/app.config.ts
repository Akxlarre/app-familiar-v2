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
  Inbox,
  Receipt,
  ShoppingCart,
  CreditCard,
  Lock,
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
import { DESTINO_REGISTRADO } from "@core/services/navegacion.service";
import { DESTINO_HOY } from "@core/models/destino.model";
import { FUENTE_DE_PENDIENTES } from "@core/models/pendiente.model";
import { BandejaPendientes } from "@features/bandeja/bandeja.pendientes";
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

    // ── Navegación: los destinos que HOY tienen contenido ──────────────────
    // La spec 0003 enumera cinco secciones y prohíbe mostrar las que todavía no
    // existen (AC4). Las dos cosas conviven porque el menú se deriva de acá:
    // Plata, Casa, Cuerpo y Ajustes se encienden agregando su línea cuando su
    // spec aterrice, y hasta entonces no aparecen. Un menú de promesas es lo
    // que hacía que el usuario entrara a pantallas vacías y dejara de abrir v1.
    { provide: DESTINO_REGISTRADO, useValue: DESTINO_HOY, multi: true },

    // ── Fuentes de pendientes ──────────────────────────────────────────────
    // Cada dominio se registra a sí mismo. Hoy no importa a ninguno: agregar un
    // módulo nunca obliga a tocar la pantalla que los junta.
    { provide: FUENTE_DE_PENDIENTES, useExisting: BandejaPendientes, multi: true },
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
        Inbox,
        Receipt,
        ShoppingCart,
        CreditCard,
        Lock,
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
