"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { Supplier, Order } from "@/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .me()
      .then(setSupplier)
      .catch(() => router.push("/login"));
    api.orders
      .list()
      .then((orders: Order[]) =>
        setPendingCount(orders.filter((o) => o.status === "pending").length),
      )
      .catch(() => {});
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar pendingCount={pendingCount} supplier={supplier} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
