export const LOW_STOCK_THRESHOLD = 5;

export interface AdminOrderMetric {
  id: string;
  total: number;
  status: string;
  public_code: string;
  customer_name: string;
  customer_instagram?: string | null;
  created_at: string;
}

export interface AdminProductMetric {
  id: string;
  name: string;
  inventory: number;
  is_active: boolean;
}

export function deriveAdminMetrics(orders: AdminOrderMetric[], products: AdminProductMetric[]) {
  const pendingOrders = orders.filter((order) => order.status === "Pending Verification");
  const lowStockProducts = products.filter((product) => product.is_active && product.inventory <= LOW_STOCK_THRESHOLD);
  const verifiedRevenue = orders
    .filter((order) => ["Processing", "Shipped", "Fulfilled"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  return {
    verifiedRevenue,
    pendingVerificationCount: pendingOrders.length,
    pendingVerification: pendingOrders.slice(0, 5),
    lowStockCount: lowStockProducts.length,
    lowStockProducts: lowStockProducts.slice(0, 5),
    activeProducts: products.filter((product) => product.is_active).length,
    recentOrders: orders.slice(0, 5),
  };
}
