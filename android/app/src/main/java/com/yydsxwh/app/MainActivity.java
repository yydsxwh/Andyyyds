package com.yydsxwh.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Capacitor WebView 壳定制：
 * - 系统返回键：有历史则后退，否则退出
 * - weixin / alipay / tel / mailto / market / intent 等外链用系统 Intent
 * - 第三方 Cookie、DOM Storage、媒体自动播放
 * - 下载走系统 DownloadManager
 * （&lt;input type=file&gt; 由 Capacitor BridgeWebChromeClient 处理）
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 须在 super.onCreate 之前注册，否则 Web 端 registerPlugin 找不到原生实现
        registerPlugin(WechatLoginPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                        return;
                    }
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        );

        configureWebView();
    }

    private void configureWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // 在 Capacitor 默认路由之上优先拦截支付 / 通讯等自定义 scheme
        webView.setWebViewClient(
            new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (uri != null && shouldOpenExternally(uri)) {
                        return openExternal(uri);
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }

                @Override
                @SuppressWarnings("deprecation")
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    if (url != null) {
                        Uri uri = Uri.parse(url);
                        if (shouldOpenExternally(uri)) {
                            return openExternal(uri);
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, url);
                }
            }
        );

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                request.setMimeType(mimeType);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("cookie", cookies);
                }
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("正在下载文件");
                request.setTitle(fileName);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                );
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(MainActivity.this, "开始下载：" + fileName, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                    Toast.makeText(MainActivity.this, "无法下载该文件", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /** 支付 / 通讯 / 应用商店等自定义 scheme，必须跳出 WebView */
    private boolean shouldOpenExternally(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null) {
            return false;
        }
        String lower = scheme.toLowerCase();
        if (
            "http".equals(lower) ||
            "https".equals(lower) ||
            "file".equals(lower) ||
            "about".equals(lower) ||
            "blob".equals(lower) ||
            "data".equals(lower) ||
            "capacitor".equals(lower)
        ) {
            String host = uri.getHost();
            if (host != null) {
                String h = host.toLowerCase();
                if (h.contains("market.android.com") || h.equals("play.google.com")) {
                    return true;
                }
            }
            return false;
        }

        return (
            lower.startsWith("weixin") ||
            lower.startsWith("wechat") ||
            "wxwork".equals(lower) ||
            lower.startsWith("alipay") ||
            "alipays".equals(lower) ||
            "tel".equals(lower) ||
            "sms".equals(lower) ||
            "smsto".equals(lower) ||
            "mailto".equals(lower) ||
            "market".equals(lower) ||
            "geo".equals(lower) ||
            "intent".equals(lower)
        );
    }

    private boolean openExternal(Uri uri) {
        try {
            Intent intent;
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
            if ("intent".equals(scheme)) {
                intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
            } else if ("market".equals(scheme)) {
                intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.setPackage("com.android.vending");
            } else {
                intent = new Intent(Intent.ACTION_VIEW, uri);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "未安装可处理该链接的应用", Toast.LENGTH_SHORT).show();
            return true;
        } catch (Exception e) {
            Toast.makeText(this, "无法打开外部应用", Toast.LENGTH_SHORT).show();
            return true;
        }
    }
}
