/**
 * 个人 IP 外平台主页：读写 SiteSettings.personSocialJson。
 * 仅服务端引用。
 */

import { prisma } from "@andyyyds/shared/db";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@andyyyds/shared/site-settings";
import {
  parsePersonSocialAccounts,
  serializePersonSocialAccounts,
  type PersonSocialAccounts,
} from "@andyyyds/person/lib/person-social";

export async function getPersonSocialAccounts(): Promise<PersonSocialAccounts> {
  const row = await getSiteSettings();
  return parsePersonSocialAccounts(row.personSocialJson);
}

export async function savePersonSocialAccounts(
  accounts: PersonSocialAccounts,
): Promise<PersonSocialAccounts> {
  const json = serializePersonSocialAccounts(accounts);
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", personSocialJson: json },
    update: { personSocialJson: json },
  });
  invalidateSiteSettingsCache();
  return parsePersonSocialAccounts(json);
}
