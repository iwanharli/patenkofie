import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  PackageCheck,
  QrCode,
  Settings,
  Users,
} from 'lucide-react'

export const navigationItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Transaksi', icon: PackageCheck, href: '/orders' },
  { label: 'Scan QR', icon: QrCode, href: '/scan' },
  { label: 'Pelanggan', icon: Users, href: '/customers' },
  { label: 'Pembayaran', icon: CreditCard, href: '/payments' },
  { label: 'Laporan', icon: BarChart3, href: '/reports' },
  { label: 'Pengaturan', icon: Settings, href: '/settings/services' },
]
