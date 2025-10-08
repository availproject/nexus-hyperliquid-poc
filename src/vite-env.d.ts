/// <reference types="vite/client" />
import { NexusSDK } from "@avail-project/nexus";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    nexus: NexusSDK;
    nexusCache: Map<string, any>;
    _unifiedBalanceObserverInitialized: boolean;
  }

  interface XMLHttpRequest {
    _method?: string;
    _url?: string;
  }
}
