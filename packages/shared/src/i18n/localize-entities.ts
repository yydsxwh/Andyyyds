import { resolveContentFields } from "@andyyyds/shared/i18n/content-resolve";
import type { AppLocale } from "@andyyyds/shared/i18n/locales";

export type LocalizedCourseCard = {
  id: string;
  title: string;
  titleSource: string;
  subtitle: string;
  subtitleSource: string;
  categoryName?: string;
};

/** 列表卡片：解析课程标题/副标题（及可选分类名） */
export async function localizeCourseCardFields(
  course: {
    id: string;
    title: string;
    subtitle: string;
    category?: { id?: string; name: string } | null;
  },
  locale: AppLocale,
): Promise<LocalizedCourseCard> {
  const fields = await resolveContentFields({
    entityType: "course",
    entityId: course.id,
    fields: {
      title: course.title,
      subtitle: course.subtitle || "",
    },
    locale,
  });
  let categoryName = course.category?.name;
  if (course.category?.id && course.category.name) {
    const cat = await resolveContentFields({
      entityType: "category",
      entityId: course.category.id,
      fields: { name: course.category.name },
      locale,
    });
    categoryName = cat.name.text;
  }
  return {
    id: course.id,
    title: fields.title.text,
    titleSource: fields.title.source,
    subtitle: fields.subtitle.text,
    subtitleSource: fields.subtitle.source,
    categoryName,
  };
}

export async function localizeMeetupCardFields(
  meetup: {
    id: string;
    title: string;
    place?: string;
  },
  locale: AppLocale,
) {
  const fields = await resolveContentFields({
    entityType: "meetup",
    entityId: meetup.id,
    fields: {
      title: meetup.title,
      place: meetup.place || "",
    },
    locale,
  });
  return {
    title: fields.title.text,
    titleSource: fields.title.source,
    place: fields.place.text,
    placeSource: fields.place.source,
  };
}
