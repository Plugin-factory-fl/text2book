import { redirect } from 'next/navigation';

export default function BookingsRedirectPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const queryString = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString();
  redirect(`/dashboard/calendar${queryString ? `?${queryString}` : ''}`);
}
