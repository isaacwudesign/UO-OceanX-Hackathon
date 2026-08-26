# Realtime (Snap Cloud)

> **Canonical reference:** [Realtime | Snap for Developers](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/realtime)

**Realtime** is a globally distributed service for low-latency messaging between clients via [**Broadcast**](https://cloud.snap.com/docs/guides/realtime/broadcast) and cross-client state via [**Presence**](https://cloud.snap.com/docs/guides/realtime/presence).

**Prerequisite:** [**Getting started with Snap Cloud**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started).

**Full product reference:** [**Snap Cloud documentation**](https://cloud.snap.com/docs).

---

## Subscribe to a channel

Realtime uses **named channels**. Below, the Lens listens on **`test-channel`** for **`broadcast`** events named **`test-event`**.

### TypeScript (add to your Getting Started component)

```typescript
async testRealtime() {
  const broadcastChannel = this.client.channel('test-channel');
  broadcastChannel
    .on('broadcast', { event: 'test-event' }, (msg) => {
      print('New message: ' + JSON.stringify(msg));
    })
    .subscribe(async (status) => {
      print('Broadcast channel status: ' + status);
      if (status === 'SUBSCRIBED') {
        print('Subscribed to channel!');
      } else if (
        status === 'CLOSED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        print('Channel closed');
      }
    });
}
```

*(Snap’s docs also use `console.log` for status in places; `print` routes cleanly to the Lens Studio Logger.)*

### JavaScript

```javascript
async function testRealtime() {
  const broadcastChannel = client.channel('test-channel');
  broadcastChannel
    .on('broadcast', { event: 'test-event' }, function (msg) {
      print('New message: ' + JSON.stringify(msg));
    })
    .subscribe(async function (status) {
      print('Broadcast channel status: ' + status);
      if (status === 'SUBSCRIBED') {
        print('Subscribed to channel!');
      } else if (
        status === 'CLOSED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        print('Channel closed');
      }
    });
}
```

Call **`testRealtime()`** after a successful sign-in. For example, extend **`initSupabase`**:

### TypeScript

```typescript
async initSupabase() {
  const options = {
    realtime: {
      heartbeatIntervalMs: 2500, // alpha workaround per Snap docs
    },
  };
  this.client = createClient(
    this.supabaseProject.url,
    this.supabaseProject.publicToken,
    options
  );
  if (this.client) {
    await this.signInUser();
    await this.testRealtime(); // or this.testRealtime() if you prefer fire-and-forget
  }
}
```

### JavaScript

```javascript
async function initSupabase() {
  const options = {
    realtime: {
      heartbeatIntervalMs: 2500,
    },
  };
  client = createClient(
    script.supabaseProject.url,
    script.supabaseProject.publicToken,
    options
  );
  if (client) {
    await signInUser();
    await testRealtime();
  }
}
```

---

## Broadcast from the dashboard

1. Open the [**Snap Cloud dashboard**](https://cloud.snap.com/) → **Realtime**.
2. **Join a channel** → enter **`test-channel`** → **Listen to channel**.
3. Use **Broadcast a message** → **Message name:** `test-event` → add a JSON payload → **Confirm**.

You should see the payload in the **Lens Studio Logger** when the Lens is subscribed.

---

## Realtime for database changes

In **Table Editor**, enable **“Broadcast changes on this table to authorized subscribers”** (wording may vary slightly) when creating or editing a table so the Lens can receive **`postgres_changes`** for inserts, updates, and deletes.

Use the same table you set up in the [**Databases**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/databases) guide (Snap names it **`test-table`** in the UI; align **`tableName`** in code with the actual table identifier, e.g. **`test_table`**).

---

## Complete Realtime example

Demonstrates:

1. **`postgres_changes`** — INSERT / UPDATE / DELETE on a table  
2. **`broadcast`** — custom messages between clients  

### TypeScript

```typescript
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from 'SupabaseClient.lspkg/supabase-snapcloud';

@component
export class RealtimeExample extends BaseScriptComponent {
  @input
  @hint('Supabase Project asset from Asset Browser')
  supabaseProject: SupabaseProject;

  @input
  @hint('Table name to subscribe to for realtime updates')
  tableName: string = 'test_table';

  @input
  @hint('Channel name for realtime subscription')
  channelName: string = 'db-changes';

  private client: SupabaseClient;
  private uid: string;
  private channel: RealtimeChannel;

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => {
      this.onStart();
    });
  }

  onStart() {
    this.initSupabase();
  }

  async initSupabase() {
    this.log('Initializing Supabase client...');
    const options = {
      realtime: {
        heartbeatIntervalMs: 2500,
      },
    };
    this.client = createClient(
      this.supabaseProject.url,
      this.supabaseProject.publicToken,
      options
    );
    if (this.client) {
      this.log('Client created successfully');
      await this.signInUser();
      if (this.uid) {
        this.log('Setting up realtime subscription...');
        await this.setupRealtimeSubscription();
      }
    }
  }

  async signInUser() {
    this.log('Signing in user...');
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: 'snapchat',
      token: '',
    });
    if (error) {
      this.log('Sign in error: ' + JSON.stringify(error));
    } else {
      const { user } = data;
      this.uid = JSON.stringify(user.id).replace(/^"(.*)"$/, '$1');
      this.log('User authenticated');
    }
  }

  async setupRealtimeSubscription() {
    this.log('--- REALTIME EXAMPLE START ---');
    this.log('Setting up two types of realtime:');
    this.log('1. Database changes (postgres_changes)');
    this.log('2. Broadcast messages (broadcast)');

    this.channel = this.client
      .channel(this.channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.tableName,
        },
        (payload) => {
          this.handleRealtimeEvent(payload);
        }
      )
      .on('broadcast', { event: 'test-event' }, (msg) => {
        this.log('--- BROADCAST MESSAGE RECEIVED ---');
        this.log('Message: ' + JSON.stringify(msg.payload));
        this.log('--- END BROADCAST ---');
      });

    this.channel.subscribe((status) => {
      this.log('Channel status: ' + status);
      if (status === 'SUBSCRIBED') {
        this.log('Realtime channel active');
        this.log('Listening for both database changes and broadcasts');
        this.testRealtimeFeatures();
      } else if (
        status === 'CLOSED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        this.log('Channel closed or error');
      }
    });
  }

  async testRealtimeFeatures() {
    await this.delay(1000);
    this.log('Testing broadcast message...');
    await this.sendBroadcastMessage('Hello from Lens Studio!');
    await this.delay(2000);
    this.log('Testing database change detection...');
    await this.testRealtimeWithInsert();
  }

  async testRealtimeWithInsert() {
    await this.delay(2000);
    this.log('Inserting test record to trigger realtime event...');
    const testMessage = 'Realtime test ' + Date.now();
    const { data, error } = await this.client
      .from(this.tableName)
      .insert([
        {
          user_id: this.uid,
          message: testMessage,
        },
      ])
      .select();
    if (error) {
      this.log('Insert failed: ' + JSON.stringify(error));
    } else {
      this.log('Test record inserted - waiting for realtime event...');
    }
  }

  handleRealtimeEvent(payload: any) {
    const eventType = payload.eventType || 'UNKNOWN';
    this.log('--- REALTIME EVENT RECEIVED ---');
    this.log('Event type: ' + eventType);
    if (payload.new) {
      this.log('New data:');
      this.log('  ID: ' + (payload.new.id || 'N/A'));
      this.log('  Message: ' + (payload.new.message || 'N/A'));
      this.log('  User ID: ' + (payload.new.user_id || 'N/A'));
    }
    if (payload.old) {
      this.log('Old data:');
      this.log('  ID: ' + (payload.old.id || 'N/A'));
    }
    this.log('--- END EVENT ---');
  }

  async sendBroadcastMessage(message: string) {
    if (!this.channel) {
      this.log('Channel not initialized');
      return;
    }
    this.log('Sending broadcast: ' + message);
    this.channel.send({
      type: 'broadcast',
      event: 'test-event',
      payload: {
        message: message,
        user_id: this.uid,
        timestamp: Date.now(),
      },
    });
    this.log('Broadcast sent successfully');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const delayedEvent = this.createEvent('DelayedCallbackEvent');
      delayedEvent.bind(() => {
        resolve();
      });
      delayedEvent.reset(ms / 1000);
    });
  }

  onDestroy() {
    this.log('Cleaning up realtime subscriptions...');
    if (this.client) {
      this.client.removeAllChannels();
    }
  }

  private log(message: string) {
    print('[RealtimeExample] ' + message);
  }
}
```

### JavaScript

```javascript
const createClient =
  require('SupabaseClient.lspkg/supabase-snapcloud').createClient;

//@input Asset.SupabaseProject supabaseProject {"hint":"Supabase Project asset from Asset Browser"}
//@input string tableName = "test_table" {"hint":"Table name to subscribe to for realtime updates"}
//@input string channelName = "db-changes" {"hint":"Channel name for realtime subscription"}

/**
 * Realtime example (JavaScript): postgres_changes + broadcast.
 */
var RealtimeExampleJS = function () {
  this.client = null;
  this.uid = null;
  this.channel = null;

  this.onAwake = function () {
    script.createEvent('OnStartEvent').bind(() => {
      this.onStart();
    });
  };

  this.onStart = function () {
    this.initSupabase();
  };

  this.initSupabase = async function () {
    this.log('Initializing Supabase client...');
    const options = {
      realtime: {
        heartbeatIntervalMs: 2500,
      },
    };
    this.client = createClient(
      script.supabaseProject.url,
      script.supabaseProject.publicToken,
      options
    );
    if (this.client) {
      this.log('Client created successfully');
      await this.signInUser();
      if (this.uid) {
        this.log('Setting up realtime subscription...');
        await this.setupRealtimeSubscription();
      }
    }
  };

  this.signInUser = async function () {
    this.log('Signing in user...');
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: 'snapchat',
      token: '',
    });
    if (error) {
      this.log('Sign in error: ' + JSON.stringify(error));
    } else {
      const user = data.user;
      this.uid = JSON.stringify(user.id).replace(/^"(.*)"$/, '$1');
      this.log('User authenticated');
    }
  };

  this.setupRealtimeSubscription = async function () {
    this.log('--- REALTIME EXAMPLE START ---');
    this.log('Setting up two types of realtime:');
    this.log('1. Database changes (postgres_changes)');
    this.log('2. Broadcast messages (broadcast)');

    this.channel = this.client
      .channel(script.channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: script.tableName,
        },
        (payload) => {
          this.handleRealtimeEvent(payload);
        }
      )
      .on('broadcast', { event: 'test-event' }, (msg) => {
        this.log('--- BROADCAST MESSAGE RECEIVED ---');
        this.log('Message: ' + JSON.stringify(msg.payload));
        this.log('--- END BROADCAST ---');
      });

    this.channel.subscribe((status) => {
      this.log('Channel status: ' + status);
      if (status === 'SUBSCRIBED') {
        this.log('Realtime channel active');
        this.log('Listening for both database changes and broadcasts');
        this.testRealtimeFeatures();
      } else if (
        status === 'CLOSED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        this.log('Channel closed or error');
      }
    });
  };

  this.testRealtimeFeatures = async function () {
    await this.delay(1000);
    this.log('Testing broadcast message...');
    await this.sendBroadcastMessage('Hello from Lens Studio!');
    await this.delay(2000);
    this.log('Testing database change detection...');
    await this.testRealtimeWithInsert();
  };

  this.testRealtimeWithInsert = async function () {
    await this.delay(2000);
    this.log('Inserting test record to trigger realtime event...');
    const testMessage = 'Realtime test ' + Date.now();
    const { data, error } = await this.client
      .from(script.tableName)
      .insert([
        {
          user_id: this.uid,
          message: testMessage,
        },
      ])
      .select();
    if (error) {
      this.log('Insert failed: ' + JSON.stringify(error));
    } else {
      this.log('Test record inserted - waiting for realtime event...');
    }
  };

  this.handleRealtimeEvent = function (payload) {
    const eventType = payload.eventType || 'UNKNOWN';
    this.log('--- REALTIME EVENT RECEIVED ---');
    this.log('Event type: ' + eventType);
    if (payload.new) {
      this.log('New data:');
      this.log('  ID: ' + (payload.new.id || 'N/A'));
      this.log('  Message: ' + (payload.new.message || 'N/A'));
      this.log('  User ID: ' + (payload.new.user_id || 'N/A'));
    }
    if (payload.old) {
      this.log('Old data:');
      this.log('  ID: ' + (payload.old.id || 'N/A'));
    }
    this.log('--- END EVENT ---');
  };

  this.sendBroadcastMessage = async function (message) {
    if (!this.channel) {
      this.log('Channel not initialized');
      return;
    }
    this.log('Sending broadcast: ' + message);
    this.channel.send({
      type: 'broadcast',
      event: 'test-event',
      payload: {
        message: message,
        user_id: this.uid,
        timestamp: Date.now(),
      },
    });
    this.log('Broadcast sent successfully');
  };

  this.delay = function (ms) {
    return new Promise((resolve) => {
      const delayedEvent = script.createEvent('DelayedCallbackEvent');
      delayedEvent.bind(() => {
        resolve();
      });
      delayedEvent.reset(ms / 1000);
    });
  };

  this.onDestroy = function () {
    this.log('Cleaning up realtime subscriptions...');
    if (this.client) {
      this.client.removeAllChannels();
    }
  };

  this.log = function (message) {
    print('[RealtimeExampleJS] ' + message);
  };
};

var instance = new RealtimeExampleJS();
instance.onAwake();
```

When this runs you should see:

1. Subscription to **`postgres_changes`** on your table  
2. A test **broadcast** sent from the Lens  
3. A test **insert** firing a database change event  
4. Logs for each in the **Logger**

---

## Advanced examples

For richer patterns (including spatial cursor vs web cursor flows), use the [**Snap Cloud sample projects**](https://github.com/specs-devs/samples/tree/main/Snap%20Cloud) on GitHub, or open them from **Lens Studio Home** when listed.
