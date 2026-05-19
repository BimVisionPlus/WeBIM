/**
 * Workflow primitives shared across all Atlas AEC issue types.
 *
 * Why a hand-rolled FSM instead of XState:
 *   - We persist state as a string column on Issue (single source of truth = DB).
 *   - Transitions are guarded by AEC-domain rules (e.g. NĐ 06/2021 Điều 21
 *     requires CĐT + TVGS + NT signoffs before an Acceptance can move
 *     from IN_PROGRESS → SIGNED).
 *   - XState is overkill when the runtime state is just a string and the
 *     guards need to query Prisma anyway.
 */

import type { OrgType } from "@atlas/db";

export type ActorContext = {
  userId: string;
  orgRoles: OrgType[];      // roles this user has across orgs (from Membership ∪ ProjectStakeholder)
  isAdmin?: boolean;
};

export type TransitionGuard<TPayload = unknown> = (
  actor: ActorContext,
  payload?: TPayload,
) => boolean | string;     // returns true to allow, or an error message string to deny

export type TransitionDef<TState extends string, TPayload = unknown> = {
  from: TState;
  to: TState;
  /** Verb used in audit log & UI buttons, e.g. "Trả lời", "Bác bỏ" */
  action: string;
  /** Org-types that may perform this transition */
  allowedRoles: OrgType[];
  guard?: TransitionGuard<TPayload>;
  /** Statutory citation displayed in the UI ("NĐ 06/2021 Điều 21") */
  ref?: string;
};

export type Workflow<TState extends string> = {
  name: string;
  initial: TState;
  terminal: TState[];
  transitions: TransitionDef<TState>[];
};

export function canTransition<S extends string>(
  wf: Workflow<S>,
  from: S,
  to: S,
  actor: ActorContext,
  payload?: unknown,
): { ok: true; transition: TransitionDef<S> } | { ok: false; error: string } {
  const t = wf.transitions.find((x) => x.from === from && x.to === to);
  if (!t) return { ok: false, error: `Không cho phép chuyển trạng thái ${from} → ${to}` };

  if (!actor.isAdmin) {
    const hasRole = t.allowedRoles.some((r) => actor.orgRoles.includes(r));
    if (!hasRole) {
      return {
        ok: false,
        error: `Vai trò không hợp lệ. Yêu cầu một trong: ${t.allowedRoles.join(", ")}`,
      };
    }
  }

  if (t.guard) {
    const g = t.guard(actor, payload);
    if (g === true) return { ok: true, transition: t };
    if (g === false) return { ok: false, error: "Guard từ chối chuyển trạng thái" };
    return { ok: false, error: g };
  }

  return { ok: true, transition: t };
}

export function nextStates<S extends string>(wf: Workflow<S>, from: S): TransitionDef<S>[] {
  return wf.transitions.filter((t) => t.from === from);
}

export function isTerminal<S extends string>(wf: Workflow<S>, state: S): boolean {
  return wf.terminal.includes(state);
}
