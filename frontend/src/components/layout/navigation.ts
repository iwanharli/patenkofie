import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  PackageCheck,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationChild {
  href: string
  label: string
  ownerOnly?: boolean
}

export interface NavigationItem {
  children?: NavigationChild[]
  href?: string
  icon: LucideIcon
  label: string
  showDividerAbove?: boolean
}

export const navigationItems: NavigationItem[] = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/orders', icon: PackageCheck, label: 'Transaksi', showDividerAbove: true },
  { href: '/payments', icon: CreditCard, label: 'Pembayaran', showDividerAbove: true },
  { href: '/expenses', icon: Wallet, label: 'Kas Kecil' },
  { href: '/customers', icon: Users, label: 'Pelanggan' },
  { href: '/reports', icon: BarChart3, label: 'Laporan', showDividerAbove: true },
  {
    children: [
      { href: '/settings/services', label: 'Harga Layanan', ownerOnly: true },
      { href: '/settings/profile', label: 'Profil Toko & Backup', ownerOnly: true },
      { href: '/settings/users', label: 'Pengguna', ownerOnly: true },
      { href: '/settings/audit', label: 'Audit Log', ownerOnly: true },
    ],
    icon: Settings,
    label: 'Pengaturan',
    showDividerAbove: true,
  },
]
