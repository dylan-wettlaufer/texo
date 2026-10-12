import type { ExplorationData } from "./types";

// These are readable sample implementations, never executed by Texo.
export const commerceExploration: ExplorationData = {
  files: [
    {
      id: "orders", path: "src/api/orders.ts", description: "Order endpoints",
      content: `import type { CheckoutInput, CommerceDependencies } from "@/src/contracts";
import { coordinatePayment } from "@/src/services/payment";
import { publishOrder } from "@/src/queues/orders";

export async function createOrder(input: CheckoutInput, deps: CommerceDependencies) {
  if (!input.idempotencyKey) throw new Error("An idempotency key is required");
  // Serialize concurrent requests for the same checkout key.
  return deps.orders.withCheckoutLock(input.idempotencyKey, async () => {
    let order = await deps.orders.findByKey(input.idempotencyKey);
    if (order && order.cartId !== input.cartId) {
      throw new Error("This key belongs to a different cart");
    }
    if (!order) {
      const cart = await deps.orders.readCart(input.cartId);
      if (cart.total <= 0) throw new Error("The cart must contain payable items");
      order = await deps.orders.createPending(cart, input.idempotencyKey);
    }
    if (order.status === "rejected") throw new Error("Payment was declined");
    if (order.status === "pending") {
      const authorization = await coordinatePayment(order, deps.provider);
      order = await deps.orders.saveAuthorization(order.id, authorization);
      if (order.status === "rejected") throw new Error("Payment was declined");
    }
    // A retry of an accepted checkout republishes safely without paying twice.
    await publishOrder(order.id, deps.queue);
    return { orderId: order.id, status: order.status };
  });
}
`,
    },
    {
      id: "payment", path: "src/services/payment.ts", description: "Payment coordination",
      content: `import type { Order, PaymentTransport } from "@/src/contracts";
import { authorizePayment } from "@/services/commerce/integrations/payments/payment.client";

export async function coordinatePayment(order: Order, provider: PaymentTransport) {
  // Use the server-side total, never a price supplied by the browser.
  return authorizePayment({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    idempotencyKey: order.checkoutKey,
  }, provider);
}
`,
    },
    {
      id: "queue-source", path: "src/queues/orders.ts", description: "Queue publishing",
      content: `import type { OrderQueue } from "@/src/contracts";

export async function publishOrder(orderId: string, queue: OrderQueue) {
  // A stable job ID prevents checkout retries from creating duplicate jobs.
  await queue.add("fulfill-order", { orderId }, {
    jobId: orderId,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
  });
}
`,
    },
    {
      id: "payment-client", path: "/services/commerce/integrations/payments/payment.client.ts", description: "Payment provider adapter",
      content: `import type { PaymentRequest, PaymentTransport } from "@/src/contracts";

export async function authorizePayment(input: PaymentRequest, provider: PaymentTransport) {
  if (input.amount <= 0) throw new Error("Payment amount must be positive");
  // Reuse this key after a timeout: the provider returns the original result.
  const result = await provider.postAuthorization({
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
  }, { idempotencyKey: input.idempotencyKey });
  if (result.status !== "approved" && result.status !== "declined") {
    throw new Error("Payment authorization is unresolved; retry with the same key");
  }
  return {
    paymentId: result.id,
    approved: result.status === "approved",
  };
}
`,
    },
    {
      id: "payment-webhook", path: "/services/commerce/integrations/payments/payment-webhook.controller.ts", description: "Payment state reconciliation",
      content: `import type { PaymentEvent, CommerceDependencies } from "@/src/contracts";

export async function handlePaymentWebhook(
  body: string,
  signature: string,
  deps: CommerceDependencies,
) {
  // Verify the original bytes before trusting any payment state.
  if (!deps.provider.verifySignature(body, signature)) {
    throw new Error("Invalid webhook signature");
  }
  const event: PaymentEvent = deps.provider.parseEvent(body);
  // The store atomically deduplicates event IDs and rejects stale state updates.
  const applied = await deps.orders.applyProviderEventOnce(event);
  return { received: true, applied };
}
`,
    },
    {
      id: "contracts", path: "src/contracts.ts", description: "Injected adapter contracts used by the sample implementations",
      content: `export interface CheckoutInput { cartId: string; idempotencyKey: string }
export interface Cart { id: string; total: number; currency: string }
export interface Order {
  id: string; cartId: string; amount: number; currency: string; checkoutKey: string;
  status: "pending" | "authorized" | "rejected";
}
export interface PaymentRequest {
  orderId: string; amount: number; currency: string; idempotencyKey: string;
}
export interface Authorization { paymentId: string; approved: boolean }
export interface PaymentEvent {
  id: string; orderId: string; paymentId: string; state: string; occurredAt: number;
}
export interface PaymentTransport {
  postAuthorization(
    input: Omit<PaymentRequest, "idempotencyKey">,
    options: { idempotencyKey: string },
  ): Promise<{ id: string; status: "approved" | "declined" | "pending" }>;
  verifySignature(body: string, signature: string): boolean;
  parseEvent(body: string): PaymentEvent;
}
export interface OrderQueue {
  add(name: string, payload: { orderId: string }, options: {
    jobId: string; attempts: number; backoff: { type: string; delay: number };
  }): Promise<void>;
}
export interface CommerceDependencies {
  provider: PaymentTransport;
  queue: OrderQueue;
  orders: {
    withCheckoutLock<T>(key: string, work: () => Promise<T>): Promise<T>;
    findByKey(key: string): Promise<Order | undefined>;
    readCart(id: string): Promise<Cart>;
    createPending(cart: Cart, key: string): Promise<Order>;
    saveAuthorization(id: string, authorization: Authorization): Promise<Order>;
    applyProviderEventOnce(event: PaymentEvent): Promise<boolean>;
  };
}
`,
    },
  ],
  functions: [
    {
      id: "create-order", fileId: "orders", name: "createOrder", componentIds: ["api", "web"],
      purpose: "Accept checkout, coordinate payment, and queue fulfillment only after the order is authorized.",
      behavior: ["Require a checkout key and serialize concurrent requests with that key.", "Load an existing order or create a pending order using the stored cart total.", "Authorize pending orders and persist the provider result before publishing a job.", "Reject declined payments. Publish accepted orders with a stable job ID and return their state."],
      inputs: ["cartId identifies the server-side cart, which supplies the payable total and currency.", "idempotencyKey identifies one checkout. Reusing it for another cart is rejected.", "deps supplies the order store, provider transport, and job queue."],
      outputs: ["An order ID and authorized status let the storefront show confirmation.", "Declines fail checkout without queuing fulfillment. Transport or queue failures propagate so a caller can retry with the same key."],
      sideEffects: ["Creates and updates order records.", "Authorizes payment and publishes a fulfillment job.", "Retries after queue failure re-use the stored authorization; a stable job ID deduplicates publishing."],
      calleeIds: ["coordinate-payment", "publish-order"],
      interactions: [
        { source: "web", target: "api", description: "Submit checkout" },
        { source: "api", target: "db", description: "Read cart and persist order/payment state" },
        { source: "api", target: "payments", description: "Authorize checkout" },
        { source: "api", target: "queue", description: "Publish fulfillment job" },
      ],
    },
    {
      id: "coordinate-payment", fileId: "payment", name: "coordinatePayment", componentIds: ["api"],
      purpose: "Translate a stored order into a payment authorization request.",
      behavior: ["Read the order's amount and currency, rather than trusting browser prices.", "Pass the checkout key and order ID to the provider adapter.", "Return the authorization result unchanged to the order endpoint."],
      inputs: ["order contains the server-side price, currency, and stable checkout key.", "provider is the injected payment transport."],
      outputs: ["An authorization result tells createOrder whether checkout can proceed.", "Provider failures propagate to checkout; retries retain the same key."],
      sideEffects: ["Invokes the provider adapter. It does not write order records itself."],
      calleeIds: ["authorize-payment"],
      interactions: [{ source: "api", target: "payments", description: "Send order details for authorization" }],
    },
    {
      id: "authorize-payment", fileId: "payment-client", name: "authorizePayment", componentIds: ["api", "payments"],
      purpose: "Ask the external payment provider to authorize an order and normalize its response.",
      behavior: ["Reject a non-positive payment amount.", "Send the order ID, total, and currency with the same idempotency key on every retry.", "Treat pending authorization as unresolved rather than assuming approval.", "Return the payment ID and approval flag for the order store."],
      inputs: ["input carries the order ID, amount, currency, and checkout idempotency key.", "provider supplies the external authorization transport."],
      outputs: ["paymentId links the order to the provider's record; approved controls whether fulfillment can be queued.", "A decline returns approved: false. Unresolved responses and transport failures throw, leaving checkout retryable."],
      sideEffects: ["Makes an external payment request that can authorize customer funds.", "The provider owns payment state and deduplicates retries using the supplied key."],
      calleeIds: [],
      interactions: [{ source: "api", target: "payments", description: "Authorize payment with the external provider" }],
    },
    {
      id: "publish-order", fileId: "queue-source", name: "publishOrder", componentIds: ["api", "queue"],
      purpose: "Publish an accepted order for asynchronous fulfillment.",
      behavior: ["Create a fulfillment payload containing the order ID.", "Use that ID as the stable job ID to deduplicate checkout retries.", "Configure five attempts with exponential backoff.", "Wait until the queue accepts the job; propagate publishing failures."],
      inputs: ["orderId identifies an already authorized order.", "queue is the injected job publisher."],
      outputs: ["Resolves after the queue accepts the job; checkout can return confirmation.", "Publishing errors leave the authorized order intact so checkout can retry without reauthorizing payment."],
      sideEffects: ["Adds a fulfillment job. Actual fulfillment happens later in the Order worker.", "Queue consumers still need idempotent processing because delivery may happen more than once."],
      calleeIds: [],
      interactions: [{ source: "api", target: "queue", description: "Publish an order for background fulfillment" }],
    },
    {
      id: "payment-webhook-handler", fileId: "payment-webhook", name: "handlePaymentWebhook", componentIds: ["api", "payments"],
      purpose: "Reconcile authenticated provider events with local order/payment state.",
      behavior: ["Verify the signature against the original request body before trusting it.", "Parse and validate the event through the injected provider adapter.", "Apply it through a store operation that deduplicates event IDs and rejects stale state.", "Acknowledge both new and already processed events."],
      inputs: ["body is the original request body; signature authenticates its sender.", "deps supplies provider verification and the order store."],
      outputs: ["received: true acknowledges delivery; applied indicates whether local state changed.", "Invalid signatures and parsing failures reject the event without updating records."],
      sideEffects: ["Updates local payment state once per event, preserving provider event ordering.", "Does not publish fulfillment itself; checkout owns initial queue publishing."],
      calleeIds: [],
      interactions: [
        { source: "payments", target: "api", description: "Deliver authenticated payment-state events" },
        { source: "api", target: "db", description: "Reconcile payment state in the order store" },
      ],
    },
  ],
  annotations: [
    {
      id: "checkout-retry", functionId: "create-order", title: "Reuse a checkout safely",
      code: `let order = await deps.orders.findByKey(input.idempotencyKey);\n    if (order && order.cartId !== input.cartId) {\n      throw new Error("This key belongs to a different cart");\n    }`,
      does: "Looks up the checkout by its stable key and rejects reuse for a different cart.",
      why: "Retries should resume the same order rather than charge again or attach one customer's checkout to another cart.",
      interactions: [{ source: "api", target: "db", description: "Find the previously accepted checkout" }],
    },
    {
      id: "persist-authorization", functionId: "create-order", title: "Persist payment before fulfillment",
      code: `const authorization = await coordinatePayment(order, deps.provider);\n      order = await deps.orders.saveAuthorization(order.id, authorization);\n      if (order.status === "rejected") throw new Error("Payment was declined");`,
      does: "Coordinates payment, saves its result, and stops declined orders before any job is published.",
      why: "A durable result lets a retry recover after publishing fails without authorizing payment twice.",
      interactions: [{ source: "api", target: "db", description: "Persist the authorization result" }, { source: "api", target: "payments", description: "Authorize checkout" }],
    },
    {
      id: "trusted-price", functionId: "coordinate-payment", title: "Use the stored order total",
      code: `return authorizePayment({\n    orderId: order.id,\n    amount: order.amount,\n    currency: order.currency,\n    idempotencyKey: order.checkoutKey,\n  }, provider);`,
      does: "Builds the provider request from the order, forwarding the stable checkout key.",
      why: "The browser cannot choose its own price, and retries must describe the same payment.",
      interactions: [{ source: "api", target: "payments", description: "Authorize the server-side amount" }],
    },
    {
      id: "provider-request", functionId: "authorize-payment", title: "Authorize with an idempotency key",
      code: `const result = await provider.postAuthorization({\n    orderId: input.orderId,\n    amount: input.amount,\n    currency: input.currency,\n  }, { idempotencyKey: input.idempotencyKey });`,
      does: "Sends the order details to the external provider using the same key for every retry.",
      why: "A timeout does not mean the payment failed. Reusing the key asks for the original result instead of creating a second authorization.",
      interactions: [{ source: "api", target: "payments", description: "External payment authorization" }],
    },
    {
      id: "provider-result", functionId: "authorize-payment", title: "Distinguish decline from uncertainty",
      code: `if (result.status !== "approved" && result.status !== "declined") {\n    throw new Error("Payment authorization is unresolved; retry with the same key");\n  }\n  return {\n    paymentId: result.id,\n    approved: result.status === "approved",\n  };`,
      does: "Returns a definite approval or decline, but throws when the provider has not resolved the payment.",
      why: "Fulfillment must not begin on an uncertain response. The payment ID supports later reconciliation.",
      interactions: [{ source: "api", target: "payments", description: "Interpret the provider response" }],
    },
    {
      id: "queue-retries", functionId: "publish-order", title: "Deduplicate and retry fulfillment jobs",
      code: `await queue.add("fulfill-order", { orderId }, {\n    jobId: orderId,\n    attempts: 5,\n    backoff: { type: "exponential", delay: 1000 },\n  });`,
      does: "Publishes a job with an order-based ID and bounded exponential retries.",
      why: "Checkout retries should not create duplicate jobs; background processing can recover from transient failures separately from payment.",
      interactions: [{ source: "api", target: "queue", description: "Publish a deduplicated fulfillment job" }],
    },
    {
      id: "verify-webhook", functionId: "payment-webhook-handler", title: "Authenticate before trusting an event",
      code: `if (!deps.provider.verifySignature(body, signature)) {\n    throw new Error("Invalid webhook signature");\n  }`,
      does: "Verifies the untouched request body and rejects invalid signatures.",
      why: "An untrusted sender must not be able to change an order's payment state.",
      interactions: [{ source: "payments", target: "api", description: "Verify the provider event" }],
    },
  ],
  flows: [{
    id: "checkout-flow", name: "Checkout", description: "Explore the request path in any order. These steps are references, not a walkthrough player.",
    steps: [
      { title: "Accept checkout", description: "Recover or create the order using a checkout key.", functionId: "create-order", annotationId: "checkout-retry" },
      { title: "Prepare payment", description: "Use the stored total and checkout key.", functionId: "coordinate-payment" },
      { title: "Authorize payment", description: "Get a definite provider result without duplicate authorization.", functionId: "authorize-payment", annotationId: "provider-request" },
      { title: "Persist the result", description: "Store payment state before allowing fulfillment.", functionId: "create-order", annotationId: "persist-authorization" },
      { title: "Publish fulfillment", description: "Queue the authorized order with bounded job retries.", functionId: "publish-order" },
      { title: "Reconcile later events", description: "Separately authenticate and apply provider webhooks.", functionId: "payment-webhook-handler" },
    ],
  }],
};
