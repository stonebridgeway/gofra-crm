import type { CrmSnapshot } from "./domain";
import { demoSnapshot } from "./fixtures";

const STORAGE_KEY = "gofra-crm-prototype:v1";

const clone = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

const pause = (duration = 320) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

export interface CrmGateway {
  load(signal?: AbortSignal): Promise<CrmSnapshot>;
  save(snapshot: CrmSnapshot): Promise<void>;
  reset(): Promise<CrmSnapshot>;
}

class BrowserMockGateway implements CrmGateway {
  async load(signal?: AbortSignal): Promise<CrmSnapshot> {
    await pause();
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return clone(demoSnapshot);
    }

    try {
      return JSON.parse(stored) as CrmSnapshot;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return clone(demoSnapshot);
    }
  }

  async save(snapshot: CrmSnapshot): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  async reset(): Promise<CrmSnapshot> {
    const snapshot = clone(demoSnapshot);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    await pause(180);
    return snapshot;
  }
}

export const crmGateway: CrmGateway = new BrowserMockGateway();
