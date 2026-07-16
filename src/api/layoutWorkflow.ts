import { useSyncExternalStore } from "react";

import { hasSameLayoutOwnership, type LayoutSession } from "./layoutSession";

export type ActiveLayoutWorkflowKind =
  | "feedback"
  | "recommend"
  | "confirm"
  | "room-transition"
  | "room-delete";

export interface ActiveLayoutWorkflowToken {
  revision: number;
  kind: ActiveLayoutWorkflowKind;
  expectedSession: LayoutSession | null;
}

export interface ActiveLayoutWorkflowState {
  kind: "idle" | ActiveLayoutWorkflowKind;
  revision: number;
  expectedSession: LayoutSession | null;
}

type WorkflowListener = () => void;

const IDLE_STATE: ActiveLayoutWorkflowState = {
  kind: "idle",
  revision: 0,
  expectedSession: null,
};

export class ActiveLayoutWorkflowCoordinator {
  private state: ActiveLayoutWorkflowState = IDLE_STATE;
  private nextRevision = 0;
  private readonly listeners = new Set<WorkflowListener>();

  begin(
    kind: ActiveLayoutWorkflowKind,
    expectedSession: LayoutSession | null,
  ): ActiveLayoutWorkflowToken {
    if (this.state.kind !== "idle") {
      throw new Error(`Layout workflow is already running: ${this.state.kind}`);
    }

    const token: ActiveLayoutWorkflowToken = {
      revision: this.nextRevision + 1,
      kind,
      expectedSession: expectedSession ? { ...expectedSession } : null,
    };
    this.nextRevision = token.revision;
    this.state = {
      kind: token.kind,
      revision: token.revision,
      expectedSession: token.expectedSession ? { ...token.expectedSession } : null,
    };
    this.publish();
    return token;
  }

  end(token: ActiveLayoutWorkflowToken): boolean {
    if (!this.isCurrent(token)) {
      return false;
    }

    this.state = {
      ...IDLE_STATE,
      revision: this.state.revision,
    };
    this.publish();
    return true;
  }

  isCurrent(
    token: ActiveLayoutWorkflowToken,
    currentSession: LayoutSession | null = token.expectedSession,
  ): boolean {
    if (this.state.kind !== token.kind || this.state.revision !== token.revision) {
      return false;
    }

    return hasSameNullableSession(token.expectedSession, currentSession)
      && hasSameNullableSession(this.state.expectedSession, currentSession);
  }

  assertEditingAllowed(): void {
    if (this.state.kind !== "idle") {
      throw new Error(`Layout editing is locked by ${this.state.kind}`);
    }
  }

  getState(): ActiveLayoutWorkflowState {
    return this.state;
  }

  subscribe(listener: WorkflowListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("배치 workflow 상태를 화면에 알리지 못했습니다.", error);
      }
    });
  }
}

const defaultWorkflowCoordinator = new ActiveLayoutWorkflowCoordinator();

export function beginActiveLayoutWorkflow(
  kind: ActiveLayoutWorkflowKind,
  expectedSession: LayoutSession | null,
): ActiveLayoutWorkflowToken {
  return defaultWorkflowCoordinator.begin(kind, expectedSession);
}

export function endActiveLayoutWorkflow(token: ActiveLayoutWorkflowToken): boolean {
  return defaultWorkflowCoordinator.end(token);
}

export function isActiveLayoutWorkflowCurrent(
  token: ActiveLayoutWorkflowToken,
  currentSession?: LayoutSession | null,
): boolean {
  return defaultWorkflowCoordinator.isCurrent(token, currentSession);
}

export function assertActiveLayoutEditingAllowed(): void {
  defaultWorkflowCoordinator.assertEditingAllowed();
}

export function getActiveLayoutWorkflowState(): ActiveLayoutWorkflowState {
  return defaultWorkflowCoordinator.getState();
}

export function subscribeActiveLayoutWorkflowState(listener: WorkflowListener): () => void {
  return defaultWorkflowCoordinator.subscribe(listener);
}

export function useActiveLayoutWorkflowState(): ActiveLayoutWorkflowState {
  return useSyncExternalStore(
    subscribeActiveLayoutWorkflowState,
    getActiveLayoutWorkflowState,
    getActiveLayoutWorkflowState,
  );
}

function hasSameNullableSession(
  first: LayoutSession | null,
  second: LayoutSession | null,
): boolean {
  if (!first || !second) {
    return first === second;
  }
  return hasSameLayoutOwnership(first, second);
}
