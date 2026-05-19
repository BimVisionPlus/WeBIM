export * from "./types";
export * from "./rfi";
export * from "./submittal";
export * from "./ncr";
export * from "./punch";
export * from "./change-order";
export * from "./nghiem-thu";
export * from "./payment";
export * from "./bid";

import { rfiWorkflow } from "./rfi";
import { submittalWorkflow } from "./submittal";
import { ncrWorkflow } from "./ncr";
import { punchWorkflow } from "./punch";
import { changeOrderWorkflow } from "./change-order";
import { acceptanceWorkflow } from "./nghiem-thu";
import { paymentWorkflow } from "./payment";
import { bidWorkflow } from "./bid";
import type { Workflow } from "./types";

/** Lookup table keyed by Issue.type (and acceptance/payment/bid as special cases). */
export const workflows = {
  RFI: rfiWorkflow,
  SUBMITTAL: submittalWorkflow,
  NCR: ncrWorkflow,
  PUNCH: punchWorkflow,
  CHANGE_ORDER: changeOrderWorkflow,
  ACCEPTANCE: acceptanceWorkflow,
  PAYMENT: paymentWorkflow,
  BID: bidWorkflow,
} as const;

export type WorkflowKey = keyof typeof workflows;

export function getWorkflow(key: WorkflowKey): Workflow<string> {
  return workflows[key] as Workflow<string>;
}
