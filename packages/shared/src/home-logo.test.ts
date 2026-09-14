import assert from "node:assert/strict";
import {
  createHomePngLogo,
  DEFAULT_HOME_LOGO,
  homeLogoEqual,
  HOME_PNG_LOGO_MAX,
  normalizeHomeLogo,
  normalizeHomePngLogos,
} from "./home-logo";

{
  const logo = normalizeHomeLogo(undefined);
  assert.equal(logo.visible, true);
  assert.equal(logo.xPercent, null);
  assert.equal(logo.yPercent, null);
  assert.equal(logo.useAnimation, true);
  assert.deepEqual(logo.pngLogos, []);
}

{
  // 坐标按 0.1% 取整并夹在 0~100，装扮里随手拖动也不会写出越界值
  const logo = normalizeHomeLogo({
    visible: false,
    xPercent: 12.34,
    yPercent: 180,
  });
  assert.equal(logo.visible, false);
  assert.equal(logo.xPercent, 12.3);
  assert.equal(logo.yPercent, 100);
}

{
  const png = createHomePngLogo("/uploads/mark.png");
  const logo = normalizeHomeLogo({ pngLogos: [png] });
  assert.equal(logo.pngLogos.length, 1);
  assert.equal(logo.pngLogos[0]?.url, "/uploads/mark.png");
  assert.equal(logo.pngLogos[0]?.visible, true);
}

{
  // 同一个 id 只留一份，且不超过挂件上限
  const png = createHomePngLogo("/uploads/mark.png");
  assert.equal(normalizeHomePngLogos([png, { ...png }]).length, 1);
  const many = Array.from({ length: HOME_PNG_LOGO_MAX + 3 }, (_, i) =>
    createHomePngLogo(`/uploads/mark-${i}.png`),
  );
  assert.equal(normalizeHomePngLogos(many).length, HOME_PNG_LOGO_MAX);
  assert.equal(normalizeHomePngLogos("not-an-array").length, 0);
}

{
  assert.equal(
    homeLogoEqual(DEFAULT_HOME_LOGO, normalizeHomeLogo(DEFAULT_HOME_LOGO)),
    true,
  );
  assert.equal(
    homeLogoEqual(DEFAULT_HOME_LOGO, normalizeHomeLogo({ xPercent: 40 })),
    false,
  );
}
