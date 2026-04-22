"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  Package,
  FileText,
  TrendingUp,
  Bell,
  DollarSign,
  LifeBuoy,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/app/logout/actions";
import { ModeToggle } from "@/components/mode-toggle";
import { UserProfileMenu } from "@/components/user-profile-menu";

export const dynamic = "force-dynamic";

function SidebarLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const linkBase =
    "flex items-center px-6 py-3 text-sm transition-all duration-200 active:scale-[0.99]";

  return (
    <>
      <Link
        href="/"
        className={`${linkBase} ${
          pathname === "/"
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <TrendingUp className="w-5 h-5 mr-3" />
        Dashboard
      </Link>
      <Link
        href="/parties"
        className={`${linkBase} ${
          pathname?.startsWith("/parties")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <Users className="w-5 h-5 mr-3" />
        Parties
      </Link>
      <Link
        href="/products"
        className={`${linkBase} ${
          pathname?.startsWith("/products")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <Package className="w-5 h-5 mr-3" />
        Products & Stock
      </Link>
      <Link
        href="/billing"
        className={`${linkBase} ${
          pathname?.startsWith("/billing")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <FileText className="w-5 h-5 mr-3" />
        Billing
      </Link>
      <Link
        href="/cashflow"
        className={`${linkBase} ${
          pathname?.startsWith("/cashflow")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <DollarSign className="w-5 h-5 mr-3" />
        Cash Flow
      </Link>
      <Link
        href="/expenses"
        className={`${linkBase} ${
          pathname?.startsWith("/expenses")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <DollarSign className="w-5 h-5 mr-3" />
        Expenses
      </Link>
      <Link
        href="/stats"
        className={`${linkBase} ${
          pathname?.startsWith("/stats")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <TrendingUp className="w-5 h-5 mr-3" />
        Statistics
      </Link>
      <Link
        href="/support"
        className={`${linkBase} ${
          pathname?.startsWith("/support")
            ? "text-gray-900 bg-gray-100 dark:bg-zinc-800/50 dark:text-gray-50 font-medium"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/50 dark:hover:text-gray-100"
        }`}
        onClick={onNavigate}
      >
        <LifeBuoy className="w-5 h-5 mr-3" />
        Support
      </Link>
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-zinc-950 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-zinc-900 shadow-md dark:shadow-none dark:border-r dark:border-zinc-800 flex-col transition-colors duration-300">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            Horizon
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enterprise Resource Platform</p>
        </div>
        <nav className="flex-1 mt-2 overflow-y-auto">
          <SidebarLinks />
        </nav>
        <div className="p-4 border-t dark:border-zinc-800">
          <form action={logout}>
            <button className="flex w-full items-center px-4 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-md transition-all duration-200 active:scale-[0.98]">
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-64 bg-white dark:bg-zinc-900 shadow-lg dark:border-r dark:border-zinc-800 flex flex-col">
            <div className="p-4 flex items-center justify-between border-b dark:border-zinc-800">
              <div>
                <h1 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  Horizon
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Horizon
                </p>
              </div>
              <button
                className="p-2 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                onClick={() => setMobileOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 mt-2 overflow-y-auto">
              <SidebarLinks onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="p-4 border-t dark:border-zinc-800">
              <form action={logout}>
                <button className="flex w-full items-center px-4 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-md transition-all duration-200 active:scale-[0.98]">
                  <LogOut className="w-5 h-5 mr-3" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
          <button
            className="flex-1 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex justify-between items-center px-4 py-3 md:px-6 md:py-4 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-md border border-border bg-card text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center space-x-3 md:space-x-4">
            <ModeToggle />
            <Link
              href="/notifications"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-muted/50 relative transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 md:w-6 md:h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
            <UserProfileMenu />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 text-gray-900 dark:text-gray-100">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}