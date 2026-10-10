import { optimize } from "./engine";
import type { Scenario } from "./model";
self.onmessage = (event: MessageEvent<Scenario>) => {
  self.postMessage(optimize(event.data));
};
