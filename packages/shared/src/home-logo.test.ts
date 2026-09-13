import assert from "node:assert/strict";
import {
  clampHomeLogoScale,
  createHomePngLogo,
  DEFAULT_HOME_LOGO,
  homeLogoEqual,
  homeLogoScalePercent,
  homeLogoSizePx,
  HOME_LOGO_SCALE_DEFAULT,
  HOME_LOGO_SCALE_MAX,
  HOME_LOGO_SCALE_MIN,
  normalizeHomeLogo,
} from "./home-logo";

{
  const logo = normalizeHomeLogo(undefined);
  assert.equal(logo.visible, true);
  assert.equal(logo.scale, HOME_LOGO_SCALE_DEFAULT);
  assert.equal(logo.xPercent, null);
  assert.equal(logo.useAnimation, true);
}

{
  const logo = normalizeHomeLogo({ visible: false, scale: 2.35, xPercent: 12.34 });
  assert.equal(logo.visible, false);
  assert.equal(logo.scale, 2.4);
  assert.equal(logo.xPercent, 12.3);
}

{
  assert.equal(clampHomeLogoScale(0.01), HOME_LOGO_SCALE_MIN);
  assert.equal(clampHomeLogoScale(99), HOME_LOGO_SCALE_MAX);
  assert.equal(clampHomeLogoScale("1.2"), 1.2);
  assert.equal(homeLogoScalePercent(1.2), 120);
  assert.equal(homeLogoSizePx(1), 96);
  assert.equal(homeLogoSizePx(2), 192);
}

{
  const png = createHomePngLogo("/uploads/mark.png");
  const logo = normalizeHomeLogo({
    pngLogos: [{ ...png, scale: 0.55 }],
  });
  assert.equal(logo.pngLogos[0]?.scale, 0.6);
  assert.equal(
    homeLogoEqual(DEFAULT_HOME_LOGO, normalizeHomeLogo(DEFAULT_HOME_LOGO)),
    true,
  );
  assert.equal(
    homeLogoEqual(DEFAULT_HOME_LOGO, normalizeHomeLogo({ scale: 1.5 })),
    false,
  );
}
