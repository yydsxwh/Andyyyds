"use client";

import { useMemo, useState } from "react";
import { CheckoutPay } from "@/components/checkout-pay";
import { OrderFormFields } from "@/components/order-form-fields";
import {
  activeOrderFormFields,
  validateOrderFormAnswers,
  type OrderFormAnswers,
  type OrderFormConfig,
} from "@andyyyds/shared/order-form";

type Props = {
  orderId: string;
  amount: number;
  channels: {
    mode: string;
    wechat: boolean;
    alipay: boolean;
    mockOnly: boolean;
  };
  orderForm: OrderFormConfig;
  initialAnswers: OrderFormAnswers;
};

export function CheckoutOrderForm({
  orderId,
  amount,
  channels,
  orderForm,
  initialAnswers,
}: Props) {
  const fields = activeOrderFormFields(orderForm);
  const [values, setValues] = useState<OrderFormAnswers>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(() => {
    if (fields.length === 0) return true;
    return validateOrderFormAnswers(orderForm, initialAnswers).ok;
  });

  const complete = useMemo(
    () => validateOrderFormAnswers(orderForm, values).ok,
    [orderForm, values],
  );

  async function ensureSaved(): Promise<boolean> {
    if (fields.length === 0) return true;
    const check = validateOrderFormAnswers(orderForm, values);
    if (!check.ok) {
      setError(check.error);
      setReady(false);
      return false;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formAnswers: values }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "保存填写信息失败");
      setReady(false);
      return false;
    }
    setReady(true);
    return true;
  }

  return (
    <div className="space-y-6">
      {fields.length > 0 ? (
        <div className="border-t border-[var(--line)] pt-6">
          <OrderFormFields
            config={orderForm}
            values={values}
            onChange={(next) => {
              setValues(next);
              setReady(false);
              setError("");
            }}
            disabled={saving}
          />
          {!ready || !complete ? (
            <button
              type="button"
              className="btn btn-secondary mt-4 w-full"
              disabled={saving || !complete}
              onClick={() => void ensureSaved()}
            >
              {saving ? "保存中…" : "确认信息，继续支付"}
            </button>
          ) : (
            <p className="mt-3 text-sm text-[var(--brand-strong)]">
              信息已确认，可选择支付方式
            </p>
          )}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </div>
      ) : null}

      {fields.length === 0 || ready ? (
        <CheckoutPay
          orderId={orderId}
          amount={amount}
          channels={channels}
          beforePay={ensureSaved}
        />
      ) : (
        <p className="text-sm text-[var(--muted)]">
          请先填写上方必填信息后再支付
        </p>
      )}
    </div>
  );
}
