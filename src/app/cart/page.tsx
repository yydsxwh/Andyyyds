import { ShopBottomNav } from "@/components/shop-bottom-nav";
import { ShopCartClient } from "@/components/shop-cart-client";
import { getSession } from "@andyyyds/shared/auth";
import { getOrderFormConfig } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "购物车",
};

export default async function CartPage() {
  const session = await getSession();
  const orderForm = await getOrderFormConfig();

  return (
    <div className="container max-w-lg py-4 pb-8 sm:py-8">
      <h1 className="mb-4 text-2xl font-semibold">购物车</h1>
      <ShopCartClient orderForm={orderForm} loggedIn={Boolean(session)} />
      <ShopBottomNav />
    </div>
  );
}
