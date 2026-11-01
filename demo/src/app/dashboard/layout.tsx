import { DemoNav } from '@/components/demo-nav';
import { DemoDataProvider } from '@/contexts/demo-data-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoDataProvider>
      <div className="min-h-screen bg-gray-50">
        <DemoNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </DemoDataProvider>
  );
}
