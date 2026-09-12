// demo-gen.ts — Chạy tay để xem conf sinh ra (không cần tsp).
//   npm run gen:demo
import { writeConfFile } from './core/ConfigGenerator.js';

const gen = writeConfFile(
  {
    id: 'DEMO',
    input: 'file /tmp/vtc-demo/input.ts --repeat',
    recordAll: true,
    confRev: 1,
    channels: [
      { name: 'demo4', serviceId: 4, isLive: true },
      { name: 'demo5', serviceId: 5, isLive: true },
    ],
  },
  'storage/conf',
);
console.log(`wrote ${gen.filePath} (live=${gen.liveCount})`);
console.log(gen.content);
