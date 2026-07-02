/**
 * server.js
 * الطبقة: نقطة التشغيل — تُقلع خادم HTTP على المنفذ من الإعدادات.
 * المسؤولية: الاستماع فقط. بناء التطبيق في app.js حتى تبقى الاختبارات مستقلة عن الشبكة.
 */

import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`[server] يعمل على http://localhost:${env.port} (${env.nodeEnv})`);
});
