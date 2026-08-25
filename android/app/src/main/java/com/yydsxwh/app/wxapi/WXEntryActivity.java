package com.yydsxwh.app.wxapi;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import com.tencent.mm.opensdk.modelbase.BaseReq;
import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.modelmsg.SendAuth;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;
import com.yydsxwh.app.WechatLoginPlugin;

/**
 * 微信开放平台要求：回调 Activity 必须位于 {applicationId}.wxapi.WXEntryActivity。
 * 收到 SendAuth 结果后转给 WechatLoginPlugin，再 finish 以免留在栈顶。
 */
public class WXEntryActivity extends Activity implements IWXAPIEventHandler {

    private IWXAPI api;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // AppID 在 handleIntent 前可为占位；handleResp 不依赖本地注册校验
        api = WXAPIFactory.createWXAPI(this, "", false);
        try {
            api.handleIntent(getIntent(), this);
        } catch (Exception e) {
            finish();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (api != null) {
            api.handleIntent(intent, this);
        }
    }

    @Override
    public void onReq(BaseReq req) {
        // App 作为接收方被拉起时一般不需要处理
        finish();
    }

    @Override
    public void onResp(BaseResp resp) {
        if (resp instanceof SendAuth.Resp) {
            WechatLoginPlugin plugin = WechatLoginPlugin.getInstance();
            if (plugin != null) {
                plugin.handleAuthResult((SendAuth.Resp) resp);
            }
        }
        finish();
    }
}
