import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageShell } from '../../components/layout/ProductManagerLayout'
import { staffApi } from '../../api/staffApi'
import { vendorApi } from '../../api/vendorApi'
import { useInventoryRequests } from '../../hooks/useInventoryRequests'
import {
  Package,
  Store,
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  Search,
  Layers,
  ArrowRight,
  Boxes,
  Tag,
  FileText,
  X,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Building2,
  Calendar,
  Barcode,
  MapPin,
  AlertCircle
} from 'lucide-react'

// Packaging Container Options
const PACKAGING_CONTAINERS = [
  { id: 'plastic_crate', label: 'Plastic Crate (25 Kg)', capacity: 25, unit: 'Crates', icon: '🧺' },
  { id: 'ventilated_crate', label: 'Ventilated Crate (15 Kg)', capacity: 15, unit: 'Crates', icon: '🥬' },
  { id: 'corrugated_box', label: 'Corrugated Box (20 Kg)', capacity: 20, unit: 'Boxes', icon: '📦' },
  { id: 'mesh_bag', label: 'Mesh / Net Bag (30 Kg)', capacity: 30, unit: 'Bags', icon: '🧅' },
  { id: 'insulated_box', label: 'Cold-Chain Insulated Box', capacity: 15, unit: 'Boxes', icon: '❄️' },
  { id: 'pouch_pack', label: 'Individual Pouch / Bunch', capacity: 1, unit: 'Pouches', icon: '🛍️' },
]

// Packaging Statuses (Clean English)
const PACKAGING_STATUSES = {
  pending: { label: 'Pending Packaging', color: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-200', icon: Clock },
  in_progress: { label: 'In Packaging', color: 'bg-blue-50 text-blue-800 border-blue-300 ring-blue-200', icon: Package },
  packed: { label: 'Packed & Sealed', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-200', icon: CheckCircle2 },
  ready: { label: 'Ready for Dispatch', color: 'bg-purple-50 text-purple-800 border-purple-300 ring-purple-200', icon: Truck },
  dispatched: { label: 'Dispatched to Darkstore', color: 'bg-gray-100 text-gray-700 border-gray-300 ring-gray-200', icon: Check },
}

// Fallback seed requests if backend database has no active requests yet
const FALLBACK_SEED_REQUESTS = [
  {
    id: 'REQ-KOT-01',
    requestNumber: 'REQ-KOT-8801',
    storeName: 'Kothrud Central Dark Store',
    managerName: 'Sachin Kadam',
    city: 'Pune',
    area: 'Kothrud (Ideal Colony)',
    sku: 'SKU-VEG-TOM-01',
    productName: 'Hybrid Fresh Tomatoes',
    category: 'Vegetables',
    unit: 'Kg',
    quantity: 75,
    currentStock: 12,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    note: 'High demand for weekend rush',
    containerType: 'plastic_crate',
    crateCount: 3,
    packageStatus: 'packed',
  },
  {
    id: 'REQ-KOT-02',
    requestNumber: 'REQ-KOT-8802',
    storeName: 'Kothrud Central Dark Store',
    managerName: 'Sachin Kadam',
    city: 'Pune',
    area: 'Kothrud (Ideal Colony)',
    sku: 'SKU-VEG-SPN-04',
    productName: 'Palak (Fresh Spinach)',
    category: 'Leafy Greens',
    unit: 'Kg',
    quantity: 30,
    currentStock: 4,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    note: 'Keep in ventilated crates',
    containerType: 'ventilated_crate',
    crateCount: 2,
    packageStatus: 'in_progress',
  },
  {
    id: 'REQ-KOT-03',
    requestNumber: 'REQ-KOT-8803',
    storeName: 'Kothrud Central Dark Store',
    managerName: 'Sachin Kadam',
    city: 'Pune',
    area: 'Kothrud (Ideal Colony)',
    sku: 'SKU-VEG-POT-08',
    productName: 'Jyoti Potatoes (A-Grade)',
    category: 'Vegetables',
    unit: 'Kg',
    quantity: 120,
    currentStock: 25,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    note: 'Standard mesh bags preferred',
    containerType: 'mesh_bag',
    crateCount: 4,
    packageStatus: 'pending',
  },
  {
    id: 'REQ-VIM-01',
    requestNumber: 'REQ-VIM-4421',
    storeName: 'Viman Nagar Express Hub',
    managerName: 'Pooja Deshmukh',
    city: 'Pune',
    area: 'Viman Nagar (Symbiosis Chowk)',
    sku: 'SKU-VEG-TOM-01',
    productName: 'Hybrid Fresh Tomatoes',
    category: 'Vegetables',
    unit: 'Kg',
    quantity: 50,
    currentStock: 8,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    note: 'Urgent stock refill needed',
    containerType: 'plastic_crate',
    crateCount: 2,
    packageStatus: 'ready',
  },
  {
    id: 'REQ-VIM-02',
    requestNumber: 'REQ-VIM-4422',
    storeName: 'Viman Nagar Express Hub',
    managerName: 'Pooja Deshmukh',
    city: 'Pune',
    area: 'Viman Nagar (Symbiosis Chowk)',
    sku: 'SKU-FRT-APL-02',
    productName: 'Shimla Royal Apple',
    category: 'Fruits',
    unit: 'Kg',
    quantity: 40,
    currentStock: 5,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    note: 'Handle with care - corrugated boxes with trays',
    containerType: 'corrugated_box',
    crateCount: 2,
    packageStatus: 'packed',
  },
  {
    id: 'REQ-HIN-01',
    requestNumber: 'REQ-HIN-9910',
    storeName: 'Hinjawadi IT Park Dark Store',
    managerName: 'Ramesh Pawar',
    city: 'Pune',
    area: 'Hinjawadi Phase 1',
    sku: 'SKU-VEG-ONI-03',
    productName: 'Nashik Red Onion (Medium)',
    category: 'Vegetables',
    unit: 'Kg',
    quantity: 150,
    currentStock: 30,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    note: 'Morning supply batch',
    containerType: 'mesh_bag',
    crateCount: 5,
    packageStatus: 'ready',
  },
  {
    id: 'REQ-HIN-02',
    requestNumber: 'REQ-HIN-9911',
    storeName: 'Hinjawadi IT Park Dark Store',
    managerName: 'Ramesh Pawar',
    city: 'Pune',
    area: 'Hinjawadi Phase 1',
    sku: 'SKU-VEG-CLF-05',
    productName: 'Fresh Cauliflower (Gobhi)',
    category: 'Vegetables',
    unit: 'Kg',
    quantity: 45,
    currentStock: 10,
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    note: 'Fresh morning harvest needed',
    containerType: 'plastic_crate',
    crateCount: 2,
    packageStatus: 'pending',
  },
]

const STORAGE_KEY = 'greengrocc_segregation_packaging_v1'

export default function InventoryRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const storeIdParam = searchParams.get('storeId') || ''

  const { requests: apiRequests, loading, error, reload } = useInventoryRequests({ storeId: storeIdParam })

  const [vendorStores, setVendorStores] = useState([])
  useEffect(() => {
    vendorApi
      .getDarkStoreRequests()
      .then((res) => {
        const list = Array.isArray(res.data?.darkStores)
          ? res.data.darkStores
          : Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : []
        setVendorStores(list)
      })
      .catch(() => setVendorStores([]))
  }, [])

  // Find store matching storeIdParam
  const selectedStoreObj = useMemo(() => {
    if (!storeIdParam) return null
    return vendorStores.find(
      (s) =>
        String(s._id || s.id) === storeIdParam ||
        String(s.deliveryManagerId || '') === storeIdParam
    )
  }, [storeIdParam, vendorStores])

  // Packaging details persisted state: { [requestId]: { containerType, crateCount, packageStatus, note } }
  const [packagingState, setPackagingState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packagingState))
    } catch (e) {
      console.warn('Failed to save packaging state:', e)
    }
  }, [packagingState])

  // UI Views & Filter States
  const [viewMode, setViewMode] = useState('darkstore') // 'darkstore' | 'product' | 'table'
  const [selectedDarkstore, setSelectedDarkstore] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState('')
  const [busyId, setBusyId] = useState('')

  // Sync selectedDarkstore when storeIdParam changes
  useEffect(() => {
    if (selectedStoreObj?.storeName) {
      setSelectedDarkstore(selectedStoreObj.storeName)
    } else if (!storeIdParam) {
      setSelectedDarkstore('all')
    }
  }, [selectedStoreObj, storeIdParam])

  // Handle darkstore change in dropdown with URL synchronization
  const handleDarkstoreChange = (newStoreName) => {
    setSelectedDarkstore(newStoreName)
    if (newStoreName === 'all') {
      const next = new URLSearchParams(searchParams)
      next.delete('storeId')
      setSearchParams(next)
    } else {
      const found = vendorStores.find((s) => s.storeName === newStoreName)
      if (found) {
        setSearchParams({ storeId: found.id || found._id })
      }
    }
  }

  // Print Modals State
  const [printLabelOrder, setPrintLabelOrder] = useState(null)
  const [printManifestStore, setPrintManifestStore] = useState(null)
  const [manifestDriver, setManifestDriver] = useState('Dattatray Shinde (MH 12 QX 4920)')

  // Combine API requests with fallback seed requests if empty
  const allOrders = useMemo(() => {
    const hasApi = Array.isArray(apiRequests) && apiRequests.length > 0
    const baseList = hasApi
      ? apiRequests
      : (storeIdParam || vendorStores.length > 0 ? [] : FALLBACK_SEED_REQUESTS)
    return baseList.map((req) => {
      const id = req.id || req._id || req.requestNumber
      const saved = packagingState[id] || {}
      
      // Auto estimate default container and crate count if not set
      const defaultContainer = req.containerType || 'plastic_crate'
      const containerConf = PACKAGING_CONTAINERS.find((c) => c.id === (saved.containerType || defaultContainer)) || PACKAGING_CONTAINERS[0]
      const defaultCrates = Math.max(1, Math.ceil((Number(req.quantity) || 10) / (containerConf.capacity || 20)))

      return {
        ...req,
        id,
        containerType: saved.containerType || req.containerType || 'plastic_crate',
        crateCount: saved.crateCount !== undefined ? saved.crateCount : (req.crateCount || defaultCrates),
        packageStatus: saved.packageStatus || req.packageStatus || (req.status === 'approved' ? 'pending' : 'pending'),
      }
    })
  }, [apiRequests, packagingState, storeIdParam, vendorStores.length])

  // Unique darkstore list for dropdown filter
  const darkstoreList = useMemo(() => {
    const set = new Set()
    vendorStores.forEach((s) => {
      if (s.storeName) set.add(s.storeName)
    })
    allOrders.forEach((o) => {
      if (o.storeName) set.add(o.storeName)
    })
    return Array.from(set)
  }, [vendorStores, allOrders])

  // Filtered orders based on search, darkstore, status
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      // Darkstore filter
      if (selectedDarkstore !== 'all' && order.storeName !== selectedDarkstore) return false

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending_approval' && order.status !== 'pending') return false
        if (statusFilter === 'approved' && order.status !== 'approved') return false
        if (statusFilter === 'pending_packaging' && order.packageStatus !== 'pending') return false
        if (statusFilter === 'packed' && order.packageStatus !== 'packed') return false
        if (statusFilter === 'ready' && order.packageStatus !== 'ready') return false
        if (statusFilter === 'dispatched' && order.packageStatus !== 'dispatched') return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match =
          (order.requestNumber && order.requestNumber.toLowerCase().includes(q)) ||
          (order.storeName && order.storeName.toLowerCase().includes(q)) ||
          (order.productName && order.productName.toLowerCase().includes(q)) ||
          (order.sku && order.sku.toLowerCase().includes(q)) ||
          (order.area && order.area.toLowerCase().includes(q)) ||
          (order.managerName && order.managerName.toLowerCase().includes(q))
        if (!match) return false
      }

      return true
    })
  }, [allOrders, selectedDarkstore, statusFilter, searchQuery])

  // Grouped by Dark Store
  const darkstoreGroups = useMemo(() => {
    const map = {}
    filteredOrders.forEach((order) => {
      const key = order.storeName || 'General Dark Store'
      if (!map[key]) {
        map[key] = {
          storeName: key,
          managerName: order.managerName || 'Store In-Charge',
          city: order.city || 'Pune',
          area: order.area || '',
          orders: [],
          totalQuantity: 0,
          totalCrates: 0,
          packedCount: 0,
        }
      }
      map[key].orders.push(order)
      map[key].totalQuantity += Number(order.quantity) || 0
      map[key].totalCrates += Number(order.crateCount) || 1
      if (order.packageStatus === 'packed' || order.packageStatus === 'ready' || order.packageStatus === 'dispatched') {
        map[key].packedCount += 1
      }
    })
    return Object.values(map)
  }, [filteredOrders])

  // Grouped by Product for Product-wise Segregation View
  const productGroups = useMemo(() => {
    const map = {}
    filteredOrders.forEach((order) => {
      const key = order.sku || order.productName
      if (!map[key]) {
        map[key] = {
          key,
          productName: order.productName,
          sku: order.sku,
          category: order.category || 'Produce',
          unit: order.unit || 'Kg',
          totalQuantity: 0,
          totalCrates: 0,
          storeBreakdown: [],
        }
      }
      map[key].totalQuantity += Number(order.quantity) || 0
      map[key].totalCrates += Number(order.crateCount) || 1
      map[key].storeBreakdown.push(order)
    })
    return Object.values(map)
  }, [filteredOrders])

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalOrdersCount = allOrders.length
    const totalQuantity = allOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
    const totalCrates = allOrders.reduce((sum, o) => sum + (Number(o.crateCount) || 1), 0)
    const packedCount = allOrders.filter((o) => o.packageStatus === 'packed' || o.packageStatus === 'ready' || o.packageStatus === 'dispatched').length
    const readyCount = allOrders.filter((o) => o.packageStatus === 'ready' || o.packageStatus === 'dispatched').length
    const pendingPkgCount = allOrders.filter((o) => o.packageStatus === 'pending').length
    const pendingApprovalCount = allOrders.filter((o) => o.status === 'pending').length

    return {
      totalOrdersCount,
      totalQuantity,
      totalCrates,
      packedCount,
      readyCount,
      pendingPkgCount,
      pendingApprovalCount,
      uniqueStores: darkstoreList.length,
      progressPercent: totalOrdersCount > 0 ? Math.round((packedCount / totalOrdersCount) * 100) : 0,
    }
  }, [allOrders, darkstoreList])

  // Update Packaging State
  const updateOrderPackaging = (orderId, key, value) => {
    setPackagingState((prev) => {
      const current = prev[orderId] || {}
      return {
        ...prev,
        [orderId]: {
          ...current,
          [key]: value,
        },
      }
    })
  }

  // Quick Action: Mark all orders for a Darkstore as Packed
  const markStoreAllPacked = (storeOrders) => {
    setPackagingState((prev) => {
      const next = { ...prev }
      storeOrders.forEach((order) => {
        const curr = next[order.id] || {}
        next[order.id] = { ...curr, packageStatus: 'packed' }
      })
      return next
    })
    setToast('All orders for this darkstore marked as Packed & Sealed!')
    setTimeout(() => setToast(''), 3500)
  }

  // Quick Action: Mark all orders for a Darkstore as Dispatched
  const dispatchStoreOrders = (storeOrders, storeName) => {
    setPackagingState((prev) => {
      const next = { ...prev }
      storeOrders.forEach((order) => {
        const curr = next[order.id] || {}
        next[order.id] = { ...curr, packageStatus: 'dispatched' }
      })
      return next
    })
    setToast(`Consignment dispatched to ${storeName}!`)
    setTimeout(() => setToast(''), 3500)
  }

  // Review backend inventory request (Approve / Reject)
  const review = async (requestId, decision) => {
    setBusyId(`${requestId}-${decision}`)
    try {
      const res = await staffApi.reviewInventoryRequest(requestId, { decision })
      setToast(res.data?.message || `Request ${decision}`)
      await reload()
    } catch (err) {
      updateOrderPackaging(requestId, 'status', decision)
      setToast(err.response?.data?.message || `Order marked as ${decision}`)
    } finally {
      setBusyId('')
      setTimeout(() => setToast(''), 3500)
    }
  }

  // Generate package codes (e.g., PKG-KOT-8801-C1)
  const generatePackageCode = (order, crateIndex = 1) => {
    const storePrefix = (order.storeName || 'DS')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4)
    const num = order.requestNumber ? order.requestNumber.replace(/\D/g, '').slice(-4) : '1001'
    return `PKG-${storePrefix}-${num}-C${crateIndex}`
  }

  return (
    <PageShell
      title="Segregation & Packaging Manager"
      subtitle="Organize darkstore restock demands, order-wise crate packaging, barcode labeling, and dispatch manifests"
    >
      {/* Toast Alert */}
      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm animate-fadeIn">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Selected Dark Store Banner */}
      {selectedStoreObj && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50/30 p-4.5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm text-2xl">
              🏪
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-lg">{selectedStoreObj.storeName}</h2>
                <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {selectedStoreObj.status || 'Active Dark Store'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 inline" />
                <span>{[selectedStoreObj.area, selectedStoreObj.city, selectedStoreObj.state].filter(Boolean).join(', ')}</span>
                {selectedStoreObj.contactPhone && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>📞 {selectedStoreObj.contactPhone}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
            >
              ← View All Dark Stores
            </button>
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Dark Stores</span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Store className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{metrics.uniqueStores}</p>
          <p className="text-[11px] text-slate-400">Restock demand hubs</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Restock Orders</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Boxes className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{metrics.totalOrdersCount}</p>
          <p className="text-[11px] text-slate-400">Total weight: <span className="font-semibold text-emerald-700">{metrics.totalQuantity.toLocaleString()} Kg</span></p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Crates / Boxes</span>
            <span className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{metrics.totalCrates}</p>
          <p className="text-[11px] text-slate-400">Calculated packaging units</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Packaging Progress</span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{metrics.progressPercent}%</p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${metrics.progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">{metrics.packedCount} of {metrics.totalOrdersCount} packed</p>
        </div>

        <div className="col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ready for Dispatch</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Truck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-700">{metrics.readyCount}</p>
          <p className="text-[11px] text-slate-400">Awaiting truck loading</p>
        </div>
      </div>

      {/* CONTROLS HEADER: VIEW TABS & FILTERS */}
      <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Main View Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('darkstore')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                viewMode === 'darkstore'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Store className="h-4 w-4" />
              <span>Darkstore Wise Segregation</span>
              <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px]">
                {darkstoreGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('product')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                viewMode === 'product'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Product Aggregate View</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
                {productGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>All Requests Table</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
                {allOrders.length}
              </span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => reload()}
            className="flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters & Search Row */}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by dark store, product, SKU, order #, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Darkstore Dropdown */}
          <div className="flex items-center gap-1.5 sm:w-64">
            <Store className="h-4 w-4 text-slate-400" />
            <select
              value={selectedDarkstore}
              onChange={(e) => handleDarkstoreChange(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">All Dark Stores</option>
              {darkstoreList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Packaging Status Filter */}
          <div className="flex items-center gap-1.5 sm:w-60">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">All Packaging Statuses</option>
              <option value="pending_packaging">Pending Packaging</option>
              <option value="packed">Packed & Sealed</option>
              <option value="ready">Ready for Dispatch</option>
              <option value="dispatched">Dispatched</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DARKSTORE-WISE SEGREGATION & ORDER PACKAGING                      */}
      {/* ========================================================================= */}
      {viewMode === 'darkstore' && (
        <div className="space-y-6">
          {darkstoreGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <Store className="mx-auto h-12 w-12 text-emerald-400" />
              <p className="mt-3 text-sm font-bold text-slate-800">
                {selectedStoreObj
                  ? `No restock requests from ${selectedStoreObj.storeName} yet`
                  : 'No dark store orders found'}
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {selectedStoreObj
                  ? 'When the store manager requests inventory from the Delivery Manager portal, the request will appear here for your review and approval.'
                  : 'Try selecting a different dark store from the dropdown or clear your search filters.'}
              </p>
              {selectedStoreObj && (
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  View All Dark Stores
                </button>
              )}
            </div>
          ) : (
            darkstoreGroups.map((storeGroup) => {
              const allStorePacked = storeGroup.orders.every(
                (o) => o.packageStatus === 'packed' || o.packageStatus === 'ready' || o.packageStatus === 'dispatched'
              )
              const percent = Math.round((storeGroup.packedCount / storeGroup.orders.length) * 100)

              return (
                <div
                  key={storeGroup.storeName}
                  className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:shadow-md"
                >
                  {/* Darkstore Master Card Header */}
                  <div className="border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/70 via-slate-50/60 to-white px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
                          <Store className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{storeGroup.storeName}</h3>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              {storeGroup.orders.length} Orders
                            </span>
                            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-800">
                              {storeGroup.totalCrates} Crates / Boxes
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                              {storeGroup.area ? `${storeGroup.area}, ` : ''}{storeGroup.city}
                            </span>
                            <span>•</span>
                            <span>Store Manager: <strong>{storeGroup.managerName}</strong></span>
                          </p>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Progress Badge */}
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-slate-600">Packaging:</span>
                            <span className="font-bold text-emerald-700">{percent}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
                          </div>
                        </div>

                        {/* Mark Store All Packed */}
                        {!allStorePacked && (
                          <button
                            type="button"
                            onClick={() => markStoreAllPacked(storeGroup.orders)}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                            title="Mark all orders for this darkstore as packed"
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Mark All Packed</span>
                          </button>
                        )}

                        {/* Print Store Dispatch Manifest */}
                        <button
                          type="button"
                          onClick={() => setPrintManifestStore(storeGroup)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                        >
                          <Printer className="h-3.5 w-3.5 text-slate-600" />
                          <span>Dispatch Manifest</span>
                        </button>

                        {/* Dispatch All to Darkstore */}
                        <button
                          type="button"
                          onClick={() => dispatchStoreOrders(storeGroup.orders, storeGroup.storeName)}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
                        >
                          <Truck className="h-3.5 w-3.5 text-white" />
                          <span>Dispatch Consignment</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ORDER-WISE PACKAGING CARDS FOR THIS DARKSTORE */}
                  <div className="divide-y divide-slate-100 p-4">
                    <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Order & Packaging Produce Details</span>
                      <span>Crate Container Specifications & Status</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-1 lg:grid-cols-1">
                      {storeGroup.orders.map((order, orderIdx) => {
                        const statusConfig = PACKAGING_STATUSES[order.packageStatus] || PACKAGING_STATUSES.pending
                        const container = PACKAGING_CONTAINERS.find((c) => c.id === order.containerType) || PACKAGING_CONTAINERS[0]
                        const isApproved = order.status === 'approved'

                        return (
                          <div
                            key={order.id}
                            className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition hover:border-slate-300 hover:bg-white md:flex-row md:items-center md:justify-between"
                          >
                            {/* Product & Order Info */}
                            <div className="flex items-start gap-3 md:w-5/12">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-800 font-bold text-sm">
                                {orderIdx + 1}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {order.requestNumber}
                                  </span>
                                  <span className="text-[11px] rounded bg-slate-200/80 px-1.5 py-0.5 font-medium text-slate-700">
                                    {order.category}
                                  </span>
                                  {isApproved ? (
                                    <span className="text-[10px] rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                      Approved
                                    </span>
                                  ) : order.status === 'rejected' ? (
                                    <span className="text-[10px] rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 ring-1 ring-rose-200">
                                      Rejected
                                    </span>
                                  ) : (
                                    <span className="text-[10px] rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200">
                                      Pending Approval
                                    </span>
                                  )}
                                </div>

                                <h4 className="mt-1 text-sm font-bold text-slate-900">{order.productName}</h4>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span>SKU: <code className="font-mono text-[11px] text-slate-600">{order.sku}</code></span>
                                  <span>•</span>
                                  <span>Req Qty: <strong className="text-slate-900 font-bold">{order.quantity} {order.unit}</strong></span>
                                  {order.currentStock !== undefined && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-400">Current Store Stock: {order.currentStock} {order.unit}</span>
                                    </>
                                  )}
                                </div>
                                {order.note && (
                                  <p className="mt-1 text-[11px] italic text-amber-800 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                    Note: {order.note}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* PACKAGING SPECIFICATION: CONTAINER TYPE & CRATE COUNT */}
                            <div className="flex flex-wrap items-center gap-3 md:w-4/12">
                              {/* Container Type Select */}
                              <div className="flex-1 min-w-[140px]">
                                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">
                                  Container Type
                                </label>
                                <div className="relative">
                                  <select
                                    value={order.containerType}
                                    onChange={(e) => {
                                      const newType = e.target.value
                                      const conf = PACKAGING_CONTAINERS.find((c) => c.id === newType) || PACKAGING_CONTAINERS[0]
                                      const calcCrates = Math.max(1, Math.ceil((Number(order.quantity) || 10) / (conf.capacity || 20)))
                                      updateOrderPackaging(order.id, 'containerType', newType)
                                      updateOrderPackaging(order.id, 'crateCount', calcCrates)
                                    }}
                                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 pr-6 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                                  >
                                    {PACKAGING_CONTAINERS.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.icon} {c.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Crate / Box Count Counter */}
                              <div className="w-28">
                                <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">
                                  Crate Count
                                </label>
                                <div className="flex h-8 items-center rounded-lg border border-slate-200 bg-white">
                                  <button
                                    type="button"
                                    onClick={() => updateOrderPackaging(order.id, 'crateCount', Math.max(1, Number(order.crateCount || 1) - 1))}
                                    className="flex h-full w-7 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-bold text-sm"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={order.crateCount}
                                    onChange={(e) => updateOrderPackaging(order.id, 'crateCount', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full text-center text-xs font-bold text-slate-800 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateOrderPackaging(order.id, 'crateCount', Number(order.crateCount || 1) + 1)}
                                    className="flex h-full w-7 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-bold text-sm"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* PACKAGING STATUS & ACTION BUTTONS */}
                            <div className="flex flex-col items-start gap-2 md:w-3/12 md:items-end">
                              {/* Packaging Status Select */}
                              <div className="w-full sm:w-auto">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={order.packageStatus}
                                    onChange={(e) => updateOrderPackaging(order.id, 'packageStatus', e.target.value)}
                                    className={`h-8 rounded-lg border px-2.5 text-xs font-bold ring-1 transition focus:outline-none ${statusConfig.color}`}
                                  >
                                    <option value="pending">Pending Packaging</option>
                                    <option value="in_progress">In Packaging</option>
                                    <option value="packed">Packed & Sealed</option>
                                    <option value="ready">Ready for Dispatch</option>
                                    <option value="dispatched">Dispatched</option>
                                  </select>
                                </div>
                              </div>

                              {/* Action Buttons: Print Crate Label & Approval */}
                              <div className="flex items-center gap-1.5">
                                {/* Print Packaging Label */}
                                <button
                                  type="button"
                                  onClick={() => setPrintLabelOrder(order)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800"
                                  title="Print package label & crate barcode"
                                >
                                  <Tag className="h-3 w-3 text-emerald-600" />
                                  <span>Print Label</span>
                                </button>

                                {/* Quick Mark Packed if pending */}
                                {order.packageStatus === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => updateOrderPackaging(order.id, 'packageStatus', 'packed')}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                  >
                                    Mark Packed
                                  </button>
                                )}

                                {/* If backend request is still pending approval */}
                                {order.status === 'pending' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={Boolean(busyId)}
                                      onClick={() => review(order.id, 'approved')}
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(busyId)}
                                      onClick={() => review(order.id, 'rejected')}
                                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PRODUCT-WISE AGGREGATION VIEW                                    */}
      {/* ========================================================================= */}
      {viewMode === 'product' && (
        <div className="space-y-4">
          {productGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <Layers className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No products found</p>
            </div>
          ) : (
            productGroups.map((group) => (
              <div
                key={group.key}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
              >
                {/* Product Header */}
                <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{group.productName}</h4>
                      <p className="text-xs text-slate-500">
                        SKU: <span className="font-mono text-slate-700">{group.sku}</span> • {group.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-500">Total Demand Needed:</span>
                      <p className="text-base font-bold text-emerald-700">
                        {group.totalQuantity} {group.unit}
                      </p>
                    </div>
                    <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-800">
                      {group.totalCrates} Crates Total
                    </div>
                  </div>
                </div>

                {/* Stores Allocation Table for this Product */}
                <div className="overflow-x-auto p-4">
                  <table className="w-full min-w-[600px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase">
                        <th className="pb-2">Dark Store</th>
                        <th className="pb-2">Requested Quantity</th>
                        <th className="pb-2">Container & Crates</th>
                        <th className="pb-2">Packaging Status</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.storeBreakdown.map((item) => {
                        const statusConf = PACKAGING_STATUSES[item.packageStatus] || PACKAGING_STATUSES.pending
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5">
                              <p className="font-bold text-slate-800">{item.storeName}</p>
                              <p className="text-[11px] text-slate-400">{item.area ? `${item.area}, ` : ''}{item.city}</p>
                            </td>
                            <td className="py-2.5">
                              <span className="font-bold text-emerald-800 text-sm">
                                {item.quantity} {item.unit}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span className="font-semibold text-slate-700">{item.crateCount} Crates</span>
                              <span className="ml-1.5 text-[11px] text-slate-400">({item.containerType.replace('_', ' ')})</span>
                            </td>
                            <td className="py-2.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${statusConf.color}`}>
                                {statusConf.label}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => setPrintLabelOrder(item)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Print Label
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: TABULAR ALL-REQUESTS VIEW                                         */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Request Number</th>
                  <th className="px-4 py-3">Dark Store Name</th>
                  <th className="px-4 py-3">Produce & SKU</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Crates / Packaging</th>
                  <th className="px-4 py-3">Packaging Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No requests found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    const statusConf = PACKAGING_STATUSES[order.packageStatus] || PACKAGING_STATUSES.pending
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-800">{order.requestNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{order.storeName}</p>
                          <p className="text-[11px] text-slate-400">{order.area ? `${order.area}, ` : ''}{order.city}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{order.productName}</p>
                          <p className="font-mono text-[11px] text-slate-400">{order.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900">{order.quantity} {order.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-purple-50 px-2 py-0.5 font-bold text-purple-800 border border-purple-200">
                            {order.crateCount} Crates
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${statusConf.color}`}>
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPrintLabelOrder(order)}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Label
                            </button>
                            {order.status === 'pending' && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={Boolean(busyId)}
                                  onClick={() => review(order.id, 'approved')}
                                  className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(busyId)}
                                  onClick={() => review(order.id, 'rejected')}
                                  className="rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PRINT PACKAGING SLIP / CRATE LABEL STICKER                      */}
      {/* ========================================================================= */}
      {printLabelOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 print:hidden">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Warehouse Packaging Label & Crate Tag</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintLabelOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Print Area */}
            <div id="segregation-print-area" className="p-6">
              <div className="rounded-xl border-2 border-dashed border-slate-800 bg-white p-5 font-sans">
                {/* Brand Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-emerald-800">GREENGROCC LOGISTICS</h2>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Darkstore Restock Crate Tag</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-black px-2 py-1 font-mono text-xs font-bold text-white">
                      {printLabelOrder.requestNumber}
                    </span>
                  </div>
                </div>

                {/* Darkstore Destination Banner */}
                <div className="my-3 rounded-lg bg-slate-100 p-2.5 border border-slate-300">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Destination Dark Store:</span>
                  <p className="text-base font-black text-slate-900">{printLabelOrder.storeName}</p>
                  <p className="text-xs font-semibold text-slate-700">
                    {printLabelOrder.area ? `${printLabelOrder.area}, ` : ''}{printLabelOrder.city} • Manager: {printLabelOrder.managerName}
                  </p>
                </div>

                {/* Produce & Packaging Spec Grid */}
                <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400">Produce Item:</span>
                    <p className="text-sm font-bold text-slate-900">{printLabelOrder.productName}</p>
                    <p className="font-mono text-[11px] text-slate-600">SKU: {printLabelOrder.sku}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400">Total Net Weight:</span>
                    <p className="text-sm font-black text-emerald-800">{printLabelOrder.quantity} {printLabelOrder.unit}</p>
                    <p className="text-[11px] text-slate-600">Category: {printLabelOrder.category}</p>
                  </div>
                </div>

                {/* Container & Crate Sequence */}
                <div className="my-3 flex items-center justify-between rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-900">Packaging Container:</span>
                    <p className="text-xs font-bold text-emerald-950">
                      {printLabelOrder.containerType.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-emerald-900">Total Crates:</span>
                    <p className="text-sm font-black text-emerald-950">{printLabelOrder.crateCount} Crates</p>
                  </div>
                </div>

                {/* Simulated Barcode / QR Section */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <div className="space-y-1">
                    <div className="font-mono text-[10px] font-bold text-slate-500">PACKAGE BARCODE:</div>
                    <div className="font-mono text-sm font-black tracking-widest text-slate-800">
                      {generatePackageCode(printLabelOrder, 1)}
                    </div>
                    {/* Visual 1D Barcode CSS simulation */}
                    <div className="flex h-8 items-center gap-[2px] bg-white pt-1">
                      {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2].map((w, i) => (
                        <div key={i} className="h-7 bg-slate-900" style={{ width: `${w}px` }} />
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <p>Packed Date: {new Date().toLocaleDateString('en-IN')}</p>
                    <p>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="mt-1 font-bold text-slate-700">QC PASSED: [ GRADE-A SEALED ]</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 print:hidden">
              <button
                type="button"
                onClick={() => setPrintLabelOrder(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
              >
                <Printer className="h-4 w-4" />
                <span>Print Label Sticker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PRINT DARKSTORE DISPATCH MANIFEST (CHALAN / GATE PASS)          */}
      {/* ========================================================================= */}
      {printManifestStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Darkstore Dispatch Manifest & Gate Pass
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintManifestStore(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Print Area */}
            <div id="segregation-print-area" className="p-6 overflow-y-auto font-sans text-xs">
              <div className="border border-slate-800 p-6 bg-white">
                {/* Letterhead */}
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                  <div>
                    <h1 className="text-xl font-black text-emerald-800 tracking-tight">GREENGROCC AGRI SUPPLY CHAIN</h1>
                    <p className="text-[11px] text-slate-600">Central Sorting & Segregation Hub • Pune Warehouse-1</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">DISPATCH MANIFEST / GATE PASS</h2>
                    <p className="font-mono text-xs font-bold text-emerald-700">
                      DSP-{Date.now().toString().slice(-6)}
                    </p>
                    <p className="text-[10px] text-slate-500">Date: {new Date().toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                {/* Consignment Target Details */}
                <div className="my-4 grid grid-cols-2 gap-4 bg-slate-50 p-3 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Destination Dark Store:</span>
                    <p className="text-sm font-bold text-slate-900">{printManifestStore.storeName}</p>
                    <p className="text-[11px] text-slate-600">{printManifestStore.area ? `${printManifestStore.area}, ` : ''}{printManifestStore.city}</p>
                    <p className="text-[11px] text-slate-600">Store Manager: <strong>{printManifestStore.managerName}</strong></p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Transport & Vehicle Details:</span>
                    <input
                      type="text"
                      value={manifestDriver}
                      onChange={(e) => setManifestDriver(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none print:border-none print:p-0"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Status: Consignment Inspected & Loaded</p>
                  </div>
                </div>

                {/* Items Manifest Table */}
                <table className="w-full border-collapse border border-slate-300 text-left text-xs my-4">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800">
                      <th className="border border-slate-300 p-2">#</th>
                      <th className="border border-slate-300 p-2">Order #</th>
                      <th className="border border-slate-300 p-2">Produce Item & SKU</th>
                      <th className="border border-slate-300 p-2 text-right">Quantity</th>
                      <th className="border border-slate-300 p-2 text-center">Container Type</th>
                      <th className="border border-slate-300 p-2 text-center">Crate Count</th>
                      <th className="border border-slate-300 p-2 text-center">Check (✓)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printManifestStore.orders.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-slate-300 p-2 font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-mono font-bold text-slate-700">{item.requestNumber}</td>
                        <td className="border border-slate-300 p-2">
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="font-mono text-[10px] text-slate-500">{item.sku}</p>
                        </td>
                        <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="border border-slate-300 p-2 text-center capitalize">
                          {item.containerType.replace('_', ' ')}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-bold">
                          {item.crateCount} Crates
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-mono">
                          [ &nbsp; ]
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={3} className="border border-slate-300 p-2 text-right">
                        Total Consignment Weight:
                      </td>
                      <td className="border border-slate-300 p-2 text-right text-emerald-800 font-black">
                        {printManifestStore.totalQuantity} Kg
                      </td>
                      <td className="border border-slate-300 p-2"></td>
                      <td className="border border-slate-300 p-2 text-center font-black text-purple-900">
                        {printManifestStore.totalCrates} Crates
                      </td>
                      <td className="border border-slate-300 p-2"></td>
                    </tr>
                  </tbody>
                </table>

                {/* Verification Signatures */}
                <div className="mt-8 grid grid-cols-3 gap-6 pt-6 border-t border-slate-300 text-center">
                  <div>
                    <div className="h-10 border-b border-slate-400"></div>
                    <p className="mt-1 text-[11px] font-bold text-slate-700">Warehouse Supervisor</p>
                    <p className="text-[10px] text-slate-400">(Dispatched By)</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-slate-400"></div>
                    <p className="mt-1 text-[11px] font-bold text-slate-700">Delivery Driver</p>
                    <p className="text-[10px] text-slate-400">(Received for Transit)</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-slate-400"></div>
                    <p className="mt-1 text-[11px] font-bold text-slate-700">Darkstore Manager</p>
                    <p className="text-[10px] text-slate-400">(Store Receipt & Stamp)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 print:hidden">
              <button
                type="button"
                onClick={() => setPrintManifestStore(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
              >
                <Printer className="h-4 w-4" />
                <span>Print Dispatch Manifest</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
