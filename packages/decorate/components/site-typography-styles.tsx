/**
 * 服务端注入站长排版 CSS（特效 / 动画绑定到 .typo-* 角色类）。
 */
export function SiteTypographyStyles({ css }: { css: string }) {
  if (!css.trim()) return null;
  return (
    <style
      data-site-typography="1"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
