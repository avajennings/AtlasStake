import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'AtlasStake',
  projectId: 'e30f4d68a1c145e78bf8f8fe7a1eec36',
  chains: [sepolia],
  ssr: false,
});
