/**
 * 前台营销面是否隐藏价格（纯函数，可在客户端组件使用）。
 * 结账/订单应付金额不受此控制，避免用户无法确认支付金额。
 * 全站开关请用服务端 getHideAllPricesFlag（见 site-settings），勿在此文件拉站点设置。
 */
export function shouldHideProductPrice(input: {
  hideAllPrices?: boolean | null;
  hidePrice?: boolean | null;
}): boolean {
  return Boolean(input.hideAllPrices) || Boolean(input.hidePrice);
}
