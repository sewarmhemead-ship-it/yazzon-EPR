/**
 * server.js
 * الطبقة: نقطة التشغيل — تُقلع خادم HTTP على المنفذ من الإعدادات.
 * المسؤولية: الاستماع فقط. بناء التطبيق في app.js حتى تبقى الاختبارات مستقلة عن الشبكة.
 */

import { app } from './app.js';

const HOST = '0.0.0.0';
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, HOST, () => {
  console.log(`[server] يعمل بنجاح على المنفذ ${PORT} (${HOST}, ${NODE_ENV})`);
});
