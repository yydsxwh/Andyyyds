import { typoRoleClass, typoRoleStyle } from "@andyyyds/decorate/lib/site-typography";

export function HomePortalCardBody({
  label,
  comingSoon,
}: {
  label: string;
  comingSoon?: boolean;
}) {
  return (
    <>
      <div
        className={`font-semibold group-hover:text-[var(--brand)] ${typoRoleClass("portalCardTitle")}`}
        style={typoRoleStyle("portalCardTitle")}
      >
        {label}
      </div>
      <p
        className={`mt-2 text-[var(--muted)] ${typoRoleClass("portalCardDesc")}`}
        style={typoRoleStyle("portalCardDesc")}
      >
        {comingSoon ? "即将开放，先了解规划" : "点击进入"}
      </p>
    </>
  );
}
