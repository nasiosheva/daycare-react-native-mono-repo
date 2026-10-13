// Mories Deo Hutapea,S.E.,S.Kom
declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export function create(element: ReactElement): { update(element: ReactElement): void; unmount(): void };
  export function act(callback: () => void | Promise<void>): void | Promise<void>;
}
