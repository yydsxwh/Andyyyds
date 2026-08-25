package com.yydsxwh.app;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.modelmsg.SendAuth;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;

/**
 * Capacitor 插件 WechatLogin：调起微信开放平台移动应用授权，把 code 回传给 Web。
 * 授权结果由 wxapi.WXEntryActivity 回调到 handleAuthResult。
 */
@CapacitorPlugin(name = "WechatLogin")
public class WechatLoginPlugin extends Plugin {

    private static WechatLoginPlugin instance;
    private PluginCall pendingLoginCall;
    private IWXAPI api;
    private String registeredAppId = "";

    @Override
    public void load() {
        instance = this;
    }

    public static WechatLoginPlugin getInstance() {
        return instance;
    }

    private IWXAPI ensureApi(String appId) {
        Context context = getContext();
        if (api == null || !appId.equals(registeredAppId)) {
            api = WXAPIFactory.createWXAPI(context, appId, true);
            api.registerApp(appId);
            registeredAppId = appId;
        }
        return api;
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        JSObject result = new JSObject();
        try {
            // 探测安装可不依赖真实 AppID；用占位注册仅用于 isWXAppInstalled
            IWXAPI probe = WXAPIFactory.createWXAPI(getContext(), "wx0000000000000000", true);
            result.put("installed", probe.isWXAppInstalled());
        } catch (Exception e) {
            result.put("installed", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void login(PluginCall call) {
        String appId = call.getString("appId", "");
        if (appId == null || appId.trim().isEmpty()) {
            call.reject("缺少移动应用 AppID");
            return;
        }
        appId = appId.trim();

        IWXAPI wxApi = ensureApi(appId);
        if (!wxApi.isWXAppInstalled()) {
            call.reject("未安装微信");
            return;
        }

        // 同一时刻只保留一次登录；新请求覆盖旧的 pending
        if (pendingLoginCall != null) {
            pendingLoginCall.reject("已有进行中的微信登录");
            pendingLoginCall = null;
        }
        pendingLoginCall = call;

        SendAuth.Req req = new SendAuth.Req();
        req.scope = "snsapi_userinfo";
        req.state = "yyds_wechat_login";
        boolean sent = wxApi.sendReq(req);
        if (!sent) {
            pendingLoginCall = null;
            call.reject("无法打开微信，请稍后重试");
        }
        // 成功则保持 call 挂起，等 WXEntryActivity 回传 code
    }

    /** 供 WXEntryActivity 转发授权结果 */
    public void handleAuthResult(SendAuth.Resp resp) {
        PluginCall call = pendingLoginCall;
        pendingLoginCall = null;
        if (call == null) {
            return;
        }
        if (resp == null) {
            call.reject("微信授权无响应");
            return;
        }
        if (resp.errCode == BaseResp.ErrCode.ERR_OK) {
            String code = resp.code != null ? resp.code : "";
            if (code.isEmpty()) {
                call.reject("微信授权未返回 code");
                return;
            }
            JSObject result = new JSObject();
            result.put("code", code);
            call.resolve(result);
            return;
        }
        if (resp.errCode == BaseResp.ErrCode.ERR_USER_CANCEL) {
            call.reject("已取消微信授权");
            return;
        }
        String msg = resp.errStr != null && !resp.errStr.isEmpty()
            ? resp.errStr
            : ("微信授权失败(" + resp.errCode + ")");
        call.reject(msg);
    }
}
