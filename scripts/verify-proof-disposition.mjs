/**
 * 学生认证预览/下载签名：preview 必须是 inline，download 才是 attachment。
 */
import assert from "node:assert/strict";
import {
  ossResponseContentDisposition,
  signOssGetUrl,
} from "../packages/shared/src/storage.ts";

assert.equal(ossResponseContentDisposition("inline"), "inline");
assert.equal(
  ossResponseContentDisposition("attachment", "学生证.jpg"),
  'attachment;filename="学生证.jpg"',
);

const creds = {
  accessKeyId: "testid",
  accessKeySecret: "testsecret",
  bucket: "demo-bucket",
  region: "cn-hongkong",
  endpoint: "",
  publicBaseUrl: "https://demo-bucket.oss-cn-hongkong.aliyuncs.com",
  prefix: "uploads",
};

const preview = signOssGetUrl({
  objectKey: "uploads/user1/proof.jpg",
  creds,
  expiresInSec: 60,
  contentDisposition: "inline",
});
const download = signOssGetUrl({
  objectKey: "uploads/user1/proof.jpg",
  creds,
  expiresInSec: 60,
  contentDisposition: "attachment",
  fileName: "student-proof.jpg",
});

assert.match(preview, /response-content-disposition=inline/);
assert.doesNotMatch(preview, /attachment/);
assert.match(download, /response-content-disposition=attachment/);
assert.doesNotMatch(download, /response-content-disposition=inline/);

console.log("ok: preview is inline, download is attachment");
