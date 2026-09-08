import { redirect } from "next/navigation";
import { PersonAdminShell } from "@andyyyds/person/components/person-admin-shell";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/person-admin");
  if (!isAdmin(session)) redirect("/studio");
  return <PersonAdminShell>{children}</PersonAdminShell>;
}
