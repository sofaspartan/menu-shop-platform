import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LandingPage } from '@/pages/marketing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { OverviewPage } from '@/pages/dashboard/OverviewPage'
import { OrdersPage } from '@/pages/dashboard/OrdersPage'
import { OrderDetailPage } from '@/pages/dashboard/OrderDetailPage'
import { NewRestaurantPage } from '@/pages/dashboard/NewRestaurantPage'
import { MenusPage } from '@/pages/dashboard/MenusPage'
import { ItemsPage } from '@/pages/dashboard/ItemsPage'
import { ModifiersPage } from '@/pages/dashboard/ModifiersPage'
import { CombosPage } from '@/pages/dashboard/CombosPage'
import { BrandingPage } from '@/pages/dashboard/BrandingPage'
import { QrPage } from '@/pages/dashboard/QrPage'
import { AnalyticsPage } from '@/pages/dashboard/AnalyticsPage'
import { SchedulingPage } from '@/pages/dashboard/SchedulingPage'
import { PreviewPage } from '@/pages/dashboard/PreviewPage'
import { SettingsPage } from '@/pages/dashboard/SettingsPage'
import { PagesPage } from '@/pages/dashboard/PagesPage'
import { LoyaltyPage } from '@/pages/dashboard/LoyaltyPage'
import { PromotionsPage } from '@/pages/dashboard/PromotionsPage'
import { PosPage } from '@/pages/dashboard/PosPage'
import { KitchenDisplayPage } from '@/pages/dashboard/KitchenDisplayPage'
import { DisplaysPage } from '@/pages/dashboard/DisplaysPage'
import { DiningPage } from '@/pages/dashboard/DiningPage'
import { TablesPage } from '@/pages/dashboard/TablesPage'
import { ServerHandheldPage } from '@/pages/dashboard/ServerHandheldPage'
import { EmployeesPage } from '@/pages/dashboard/EmployeesPage'
import { DisplayBoardPage } from '@/pages/storefront/DisplayBoardPage'
import { RestaurantPage } from '@/pages/storefront/RestaurantPage'
import { AboutPage } from '@/pages/storefront/AboutPage'
import { ContactPage } from '@/pages/storefront/ContactPage'
import { ReservePage } from '@/pages/storefront/ReservePage'
import { CheckoutPage } from '@/pages/storefront/CheckoutPage'
import { OrderTrackerPage } from '@/pages/storefront/OrderTrackerPage'
import { useAuthStore } from '@/stores/authStore'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="kitchen" element={<KitchenDisplayPage />} />
          <Route path="dining" element={<DiningPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="server" element={<ServerHandheldPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="menus" element={<MenusPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="modifiers" element={<ModifiersPage />} />
          <Route path="combos" element={<CombosPage />} />
          <Route path="branding" element={<BrandingPage />} />
          <Route path="qr" element={<QrPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="scheduling" element={<SchedulingPage />} />
          <Route path="preview" element={<PreviewPage />} />
          <Route path="displays" element={<DisplaysPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="loyalty" element={<LoyaltyPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="restaurants/new" element={<NewRestaurantPage />} />
        </Route>

        <Route path="/r/:slug" element={<RestaurantPage />} />
        <Route path="/r/:slug/shop" element={<RestaurantPage />} />
        <Route path="/r/:slug/menu/:menuSlug" element={<RestaurantPage />} />
        <Route path="/r/:slug/about" element={<AboutPage />} />
        <Route path="/r/:slug/contact" element={<ContactPage />} />
        <Route path="/r/:slug/reserve" element={<ReservePage />} />
        <Route path="/r/:slug/checkout" element={<CheckoutPage />} />
        <Route path="/r/:slug/display/:displaySlug" element={<DisplayBoardPage />} />
        <Route path="/order/:reference" element={<OrderTrackerPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
