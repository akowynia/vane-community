import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Model Statistics - Vane-Community',
  description: 'LLM telemetry, token analytics, response latency, and performance breakdown.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
