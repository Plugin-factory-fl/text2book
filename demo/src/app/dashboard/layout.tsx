import { DemoNav } from '@/components/demo-nav';
import { DashboardMain } from '@/components/dashboard-main';
import { DemoDataProvider } from '@/contexts/demo-data-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoDataProvider>
      <div className="h-dvh flex flex-col overflow-hidden bg-gray-50">
        <div className="flex-shrink-0">
          <DemoNav />
        </div>
        <DashboardMain>{children}</DashboardMain>
      </div>
    </DemoDataProvider>
  );
}
