"use client";

import { MeetupEditorForm } from "@/components/meetup-editor-form";

/** 前台「发起约搭」：走公开 API，成功进详情 */
export function MeetupCreateForm() {
  return (
    <MeetupEditorForm
      mode="create"
      apiPath="/api/meetup"
      successHref="/meetup/{id}"
      submitLabel="发布约搭"
    />
  );
}
