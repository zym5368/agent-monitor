import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clustermanager.app',
  appName: '集群管理',
  webDir: 'dist-mobile',
  // WebView 为 https 源；访问局域网 http:// Agent/Netdata 需允许混合内容，否则 fetch 被静默拦截
  android: {
    allowMixedContent: true,
  },
};

export default config;
