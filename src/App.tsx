import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
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
const Cart = lazyWithRetry(() => import("./pages/Cart"));
const Checkout = lazyWithRetry(() => import("./pages/Checkout"));
const OnlinePayment = lazyWithRetry(() => import("./pages/OnlinePayment"));
const OrderStatus = lazyWithRetry(() => import("./pages/OrderStatus"));
const MyOrders = lazyWithRetry(() => import("./pages/MyOrders"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const RestaurantSuspended = lazyWithRetry(() => import("./pages/RestaurantSuspended"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));

// Lazy: admin
const AdminOrders = lazyWithRetry(() => import("./pages/admin/Orders"));
const AdminProducts = lazyWithRetry(() => import("./pages/admin/Products"));
const AdminPizzeria = lazyWithRetry(() => import("./pages/admin/Pizzeria"));
const AdminCategories = lazyWithRetry(() => import("./pages/admin/Categories"));
const AdminCoupons = lazyWithRetry(() => import("./pages/admin/Coupons"));
const AdminHours = lazyWithRetry(() => import("./pages/admin/Hours"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/Settings"));
const AdminSetup = lazyWithRetry(() => import("./pages/admin/Setup"));
const AdminDeliveryZones = lazyWithRetry(() => import("./pages/admin/DeliveryZones"));
const AdminAddons = lazyWithRetry(() => import("./pages/admin/Addons"));
const AdminPDV = lazyWithRetry(() => import("./pages/admin/PDV"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/Dashboard"));
const AdminWaiters = lazyWithRetry(() => import("./pages/admin/Waiters"));
const AdminWhatsApp = lazyWithRetry(() => import("./pages/admin/WhatsAppConnections"));
const AdminChat = lazyWithRetry(() => import("./pages/admin/Chat"));
const AdminAIAgents = lazyWithRetry(() => import("./pages/admin/AIAgents"));
const AdminImageEnhancer = lazyWithRetry(() => import("./pages/admin/ImageEnhancer"));
const AdminCashRegister = lazyWithRetry(() => import("./pages/admin/CashRegister"));
const AdminFiscalPanel = lazyWithRetry(() => import("./pages/admin/FiscalPanel"));
const AdminPrintSettings = lazyWithRetry(() => import("./pages/admin/PrintSettings"));
const AdminStock = lazyWithRetry(() => import("./pages/admin/Stock"));
const AdminStockMovements = lazyWithRetry(() => import("./pages/admin/StockMovements"));
const AdminStockSuppliers = lazyWithRetry(() => import("./pages/admin/StockSuppliers"));
const AdminStockPurchases = lazyWithRetry(() => import("./pages/admin/StockPurchases"));
const AdminStockRecipes = lazyWithRetry(() => import("./pages/admin/StockRecipes"));
const AdminStockReports = lazyWithRetry(() => import("./pages/admin/StockReports"));
const AdminDrivers = lazyWithRetry(() => import("./pages/admin/Drivers"));
const AdminDeliveryMap = lazyWithRetry(() => import("./pages/admin/DeliveryMap"));
const DriverApp = lazyWithRetry(() => import("./pages/DriverApp"));


// Lazy: waiter / kitchen
const WaiterAccess = lazyWithRetry(() => import("./pages/WaiterAccess"));
const WaiterDashboard = lazyWithRetry(() => import("./pages/WaiterDashboard"));
const Kitchen = lazyWithRetry(() => import("./pages/Kitchen"));
const KitchenLogin = lazyWithRetry(() => import("./pages/KitchenLogin"));

// Lazy: reseller
const ResellerDashboard = lazyWithRetry(() => import("./pages/reseller/Dashboard"));
const ResellerRestaurants = lazyWithRetry(() => import("./pages/reseller/Restaurants"));
const ResellerRestaurantDetails = lazyWithRetry(() => import("./pages/reseller/RestaurantDetails"));
const ResellerSubscriptions = lazyWithRetry(() => import("./pages/reseller/Subscriptions"));
const ResellerReports = lazyWithRetry(() => import("./pages/reseller/Reports"));
const ResellerSettings = lazyWithRetry(() => import("./pages/reseller/Settings"));
const ResellerPlans = lazyWithRetry(() => import("./pages/reseller/Plans"));
const ResellerBusinessTypes = lazyWithRetry(() => import("./pages/reseller/BusinessTypes"));
const ResellerMercadoPago = lazyWithRetry(() => import("./pages/reseller/MercadoPago"));
const ResellerMercadoPagoGuide = lazyWithRetry(() => import("./pages/reseller/MercadoPagoGuide"));
const ResellerDocs = lazyWithRetry(() => import("./pages/reseller/Docs"));
const ResellerWhatsApp = lazyWithRetry(() => import("./pages/reseller/WhatsAppEvolution"));
const ResellerAIRouting = lazyWithRetry(() => import("./pages/reseller/AIRouting"));
const ResellerSetup = lazyWithRetry(() => import("./pages/ResellerSetup"));
const SetupRouteGuard = lazyWithRetry(() => import("./pages/SetupRouteGuard"));

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
