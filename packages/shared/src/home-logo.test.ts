import assert from "node:assert/strict";
import {
  createHomePngLogo,
  DEFAULT_HOME_LOGO,
  homeLogoEqual,
  normalizeHomeLogo,
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
  const logo = normalizeHomeLogo({
    visible: false,
    xPercent: 12.34,
    yPercent: -5,
    useAnimation: false,
  });
  assert.equal(logo.visible, false);
  assert.equal(logo.xPercent, 12.3);
  assert.equal(logo.yPercent, 0);
  assert.equal(logo.useAnimation, false);
}

{
  const logo = normalizeHomeLogo({
    xPercent: 101,
    yPercent: 50.66,
  });
  assert.equal(logo.xPercent, 100);
  assert.equal(logo.yPercent, 50.7);
}

{
  const png = createHomePngLogo("/uploads/mark.png");
  assert.equal(png.url, "/uploads/mark.png");
  assert.equal(png.visible, true);
  assert.equal(png.xPercent, null);
  assert.equal(png.yPercent, null);

  const logo = normalizeHomeLogo({
    pngLogos: [{ ...png, xPercent: 12.34, yPercent: 56.78 }],
  });
  assert.equal(logo.pngLogos[0]?.xPercent, 12.3);
  assert.equal(logo.pngLogos[0]?.yPercent, 56.8);
}

{
  const logo = normalizeHomeLogo({
    pngLogos: [
      { id: "one", url: "/one.png" },
      { id: "one", url: "/duplicate.png" },
      { id: "two", url: "/two.png" },
    ],
  });
  assert.equal(logo.pngLogos.length, 2);
  assert.equal(logo.pngLogos[0]?.id, "one");
  assert.equal(logo.pngLogos[1]?.id, "two");
}

assert.equal(
  homeLogoEqual(DEFAULT_HOME_LOGO, normalizeHomeLogo(DEFAULT_HOME_LOGO)),
  true,
);
assert.equal(
  homeLogoEqual(DEFAULT_HOME_LOGO, normalizeHomeLogo({ visible: false })),
  false,
);
