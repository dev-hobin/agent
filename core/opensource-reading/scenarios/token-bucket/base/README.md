# tiny-bucket

Synthetic example project for a repository reading exercise.

A token bucket rate limiter with no dependencies.

```js
import { createBucket } from "tiny-bucket";

const bucket = createBucket({ capacity: 5, refillPerSecond: 1 });
if (bucket.take()) handle(request);
else reject(request);
```

- `capacity`: the largest burst the bucket allows.
- `refillPerSecond`: tokens added per second, up to `capacity`.
- `take(cost = 1)`: returns `true` and removes `cost` tokens when enough are
  available; otherwise returns `false` and removes nothing.

The bucket starts full.
