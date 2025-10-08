import { NexusSDK } from "@avail-project/nexus";

export const hasNexusInit = async () => {
  if (!window.nexus?.getUnifiedBalances) {
    let isNexusInit = false;
    while (!isNexusInit) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      isNexusInit = (window.nexus as unknown as NexusSDK)?.getUnifiedBalances
        ? true
        : false;
    }
  }
  return true;
};
