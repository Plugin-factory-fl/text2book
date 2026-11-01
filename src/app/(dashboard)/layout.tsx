import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { DashboardNav } from '@/components/dashboard/nav';
import { DashboardMain } from '@/components/dashboard/dashboard-main';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-shrink-0">
        <DashboardNav user={session.user} />
      </div>
      <DashboardMain>{children}</DashboardMain>
    </div>
  );
}
