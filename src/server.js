/**
 * server.js
 * الطبقة: نقطة التشغيل — تُقلع خادم HTTP على المنفذ من الإعدادات.
 * المسؤولية: الاستماع فقط. بناء التطبيق في app.js حتى تبقى الاختبارات مستقلة عن الشبكة.
 */

import { app } from './app.js';
import { env } from './config/env.js';

const HOST = '0.0.0.0';

app.listen(env.port, HOST, () => {
  console.log(`[server] يعمل على ${HOST}:${env.port} (${env.nodeEnv})`);
});
