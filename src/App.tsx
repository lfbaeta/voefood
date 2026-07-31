import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { CartProvider } from "@/hooks/useCart";
import { AuthProvider } from "@/hooks/useAuth";
import { getSubdomain, shouldUsePathBasedRouting, getCurrentRootDomain } from "@/lib/getSubdomain";

// Eager: leves e usados na primeira tela do cliente
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import InitialRedirect from "./pages/InitialRedirect";
import AdminOnRoot from "./pages/AdminOnRoot";

// Lazy: client
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OnlinePayment = lazy(() => import("./pages/OnlinePayment"));
const OrderStatus = lazy(() => import("./pages/OrderStatus"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Auth = lazy(() => import("./pages/Auth"));
const RestaurantSuspended = lazy(() => import("./pages/RestaurantSuspended"));
const Landing = lazy(() => import("./pages/Landing"));

// Lazy: admin
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminPizzeria = lazy(() => import("./pages/admin/Pizzeria"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminCoupons = lazy(() => import("./pages/admin/Coupons"));
const AdminHours = lazy(() => import("./pages/admin/Hours"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminSetup = lazy(() => import("./pages/admin/Setup"));
const AdminDeliveryZones = lazy(() => import("./pages/admin/DeliveryZones"));
const AdminAddons = lazy(() => import("./pages/admin/Addons"));
const AdminPDV = lazy(() => import("./pages/admin/PDV"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminWaiters = lazy(() => import("./pages/admin/Waiters"));
const AdminWhatsApp = lazy(() => import("./pages/admin/WhatsAppConnections"));
const AdminChat = lazy(() => import("./pages/admin/Chat"));
const AdminAIAgents = lazy(() => import("./pages/admin/AIAgents"));
const AdminImageEnhancer = lazy(() => import("./pages/admin/ImageEnhancer"));
const AdminCashRegister = lazy(() => import("./pages/admin/CashRegister"));
const AdminFiscalPanel = lazy(() => import("./pages/admin/FiscalPanel"));
const AdminPrintSettings = lazy(() => import("./pages/admin/PrintSettings"));
const AdminStock = lazy(() => import("./pages/admin/Stock"));
const AdminStockMovements = lazy(() => import("./pages/admin/StockMovements"));
const AdminStockSuppliers = lazy(() => import("./pages/admin/StockSuppliers"));
const AdminStockPurchases = lazy(() => import("./pages/admin/StockPurchases"));
const AdminStockRecipes = lazy(() => import("./pages/admin/StockRecipes"));
const AdminStockReports = lazy(() => import("./pages/admin/StockReports"));
const AdminDrivers = lazy(() => import("./pages/admin/Drivers"));
const AdminDeliveryMap = lazy(() => import("./pages/admin/DeliveryMap"));
const DriverApp = lazy(() => import("./pages/DriverApp"));


// Lazy: waiter / kitchen
const WaiterAccess = lazy(() => import("./pages/WaiterAccess"));
const WaiterDashboard = lazy(() => import("./pages/WaiterDashboard"));
const Kitchen = lazy(() => import("./pages/Kitchen"));
const KitchenLogin = lazy(() => import("./pages/KitchenLogin"));

// Lazy: reseller
const ResellerDashboard = lazy(() => import("./pages/reseller/Dashboard"));
const ResellerRestaurants = lazy(() => import("./pages/reseller/Restaurants"));
const ResellerRestaurantDetails = lazy(() => import("./pages/reseller/RestaurantDetails"));
const ResellerSubscriptions = lazy(() => import("./pages/reseller/Subscriptions"));
const ResellerReports = lazy(() => import("./pages/reseller/Reports"));
const ResellerSettings = lazy(() => import("./pages/reseller/Settings"));
const ResellerPlans = lazy(() => import("./pages/reseller/Plans"));
const ResellerBusinessTypes = lazy(() => import("./pages/reseller/BusinessTypes"));
const ResellerMercadoPago = lazy(() => import("./pages/reseller/MercadoPago"));
const ResellerMercadoPagoGuide = lazy(() => import("./pages/reseller/MercadoPagoGuide"));
const ResellerDocs = lazy(() => import("./pages/reseller/Docs"));
const ResellerWhatsApp = lazy(() => import("./pages/reseller/WhatsAppEvolution"));
const ResellerAIRouting = lazy(() => import("./pages/reseller/AIRouting"));
const ResellerSetup = lazy(() => import("./pages/ResellerSetup"));
const SetupRouteGuard = lazy(() => import("./pages/SetupRouteGuard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function LegacySlugRedirect() {
  const location = useLocation();
  const match = location.pathname.match(/^\/r\/([^/]+)(\/.*)?$/);
  if (!match) return <NotFound />;
  const slug = match[1];
  const rest = match[2] ?? "";
  const hostname = window.location.hostname;
  if (shouldUsePathBasedRouting(hostname)) {
    return <RestaurantRoutes />;
  }
  const root = getCurrentRootDomain(hostname);
  const target = `${window.location.protocol}//${slug}.${root}${rest}${location.search}${location.hash}`;
  window.location.replace(target);
  return null;
}

function RestaurantRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="cart" element={<Cart />} />
      <Route path="checkout" element={<Checkout />} />
      <Route path="payment/:id" element={<OnlinePayment />} />
      <Route path="order/:id" element={<OrderStatus />} />
      <Route path="my-orders" element={<MyOrders />} />
      <Route path="auth" element={<Auth />} />
      <Route path="suspended" element={<RestaurantSuspended />} />

      <Route path="admin" element={<AdminDashboard />} />
      <Route path="admin/orders" element={<AdminOrders />} />
      <Route path="admin/products" element={<AdminProducts />} />
      <Route path="admin/pizzeria" element={<AdminPizzeria />} />
      <Route path="admin/categories" element={<AdminCategories />} />
      <Route path="admin/coupons" element={<AdminCoupons />} />
      <Route path="admin/hours" element={<AdminHours />} />
      <Route path="admin/delivery-zones" element={<AdminDeliveryZones />} />
      <Route path="admin/settings" element={<AdminSettings />} />
      <Route path="admin/setup" element={<AdminSetup />} />
      <Route path="admin/addons" element={<AdminAddons />} />
      <Route path="admin/pdv" element={<AdminPDV />} />
      <Route path="admin/cash-register" element={<AdminCashRegister />} />
      <Route path="admin/waiters" element={<AdminWaiters />} />
      <Route path="admin/whatsapp" element={<AdminWhatsApp />} />
      <Route path="admin/chat" element={<AdminChat />} />
      <Route path="admin/ai-agents" element={<AdminAIAgents />} />
      <Route path="admin/image-enhancer" element={<AdminImageEnhancer />} />
      <Route path="admin/fiscal" element={<AdminFiscalPanel />} />
      <Route path="admin/fiscal-config" element={<Navigate to="../fiscal" replace />} />
      <Route path="admin/print-settings" element={<AdminPrintSettings />} />
      <Route path="admin/stock" element={<AdminStock />} />
      <Route path="admin/stock/movements" element={<AdminStockMovements />} />
      <Route path="admin/stock/suppliers" element={<AdminStockSuppliers />} />
      <Route path="admin/stock/purchases" element={<AdminStockPurchases />} />
      <Route path="admin/stock/recipes" element={<AdminStockRecipes />} />
      <Route path="admin/stock/reports" element={<AdminStockReports />} />
      <Route path="admin/drivers" element={<AdminDrivers />} />
      <Route path="admin/delivery-map" element={<AdminDeliveryMap />} />

      <Route path="entregador" element={<DriverApp />} />


      <Route path="waiter" element={<WaiterAccess />} />
      <Route path="waiter/dashboard" element={<WaiterDashboard />} />
      <Route path="kitchen" element={<Kitchen department="kitchen" />} />
      <Route path="kitchen/login" element={<KitchenLogin />} />
      <Route path="bar" element={<Kitchen department="bar" />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function RootRoutes() {
  return (
    <Routes>
      <Route path="/" element={<InitialRedirect />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/r/:slug/*" element={<LegacySlugRedirect />} />
      <Route path="/admin/*" element={<AdminOnRoot />} />
      <Route path="/lp/:resellerSlug" element={<Landing />} />

      <Route
        path="/setup"
        element={
          <SetupRouteGuard>
            <ResellerSetup />
          </SetupRouteGuard>
        }
      />
      <Route path="/reseller" element={<ResellerDashboard />} />
      <Route path="/reseller/restaurants" element={<ResellerRestaurants />} />
      <Route path="/reseller/restaurants/:id" element={<ResellerRestaurantDetails />} />
      <Route path="/reseller/subscriptions" element={<ResellerSubscriptions />} />
      <Route path="/reseller/reports" element={<ResellerReports />} />
      <Route path="/reseller/settings" element={<ResellerSettings />} />
      <Route path="/reseller/plans" element={<ResellerPlans />} />
      <Route path="/reseller/business-types" element={<ResellerBusinessTypes />} />
      <Route path="/reseller/mercadopago" element={<ResellerMercadoPago />} />
      <Route path="/reseller/whatsapp" element={<ResellerWhatsApp />} />
      <Route path="/reseller/ai-routing" element={<ResellerAIRouting />} />
      <Route path="/reseller/guia-mercadopago" element={<ResellerMercadoPagoGuide />} />
      <Route path="/docs" element={<ResellerDocs />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppRoutes() {
  const subdomain = getSubdomain();
  if (subdomain) {
    return (
      <Routes>
        <Route path="/*" element={<RestaurantRoutes />} />
      </Routes>
    );
  }
  return <RootRoutes />;
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
                <AppRoutes />
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
