# Snap Cloud: known issues & usage limits

> **Canonical reference:** [Usage limits | Snap for Developers](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/usage_limits)

---

## Known issues (realtime heartbeat)

Realtime connectivity has a known limitation during the **Snap Cloud alpha**. **Before** creating the Supabase client in your Lens Studio script, pass client options with **`realtime.heartbeatIntervalMs`** set to **`2500`**.

### TypeScript

```typescript
const options = {
  realtime: {
    // Temporary fix due to a known alpha limitation
    heartbeatIntervalMs: 2500,
  },
};

this.client = createClient(
  this.supabaseProject.url,
  this.supabaseProject.publicToken,
  options
);
```

### JavaScript

```javascript
const options = {
  realtime: {
    heartbeatIntervalMs: 2500,
  },
};

const client = createClient(
  script.supabaseProject.url,
  script.supabaseProject.publicToken,
  options
);
```

This pattern appears across the Snap Cloud guides (Getting Started, Databases, Storage, Realtime, etc.). Remove or adjust only when Snap documents that the limitation is resolved.

---

## Usage limits

[**Snap Cloud**](https://cloud.snap.com/) platform limits (as documented by Snap) are summarized below. To request higher limits, file a [**support request**](https://cloud.snap.com/dashboard/support/new) with Snap Cloud.

**Privacy note:** Today, Lenses using Snap Cloud can access **user-sensitive data** when the end user **grants permission**. Future releases may **restrict** some data types **even if** the user has granted permission. Plan and review your data handling accordingly.

### General

- **2** projects  
- **Unlimited** total users  
- **50,000** MAU  

### Databases

- **Unlimited** API requests  
- **500 MB** database size per project  
- **5 GB** egress  

### Edge functions

- **500,000** invocations  

### Storage

- **1 GB** total space  
- **50 MB** maximum file upload size  
- Basic **CDN** content delivery  

### Realtime

- **200** peak concurrent connections  
- **2 million** messages per month  
- **250 KB** maximum message size  

---

Limits and policies can change; treat the [official usage limits page](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/usage_limits) and [Snap Cloud dashboard](https://cloud.snap.com/) as the source of truth.
