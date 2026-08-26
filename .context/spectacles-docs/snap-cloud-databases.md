# Databases (Snap Cloud)

> **Canonical reference:** [Databases | Snap for Developers](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/databases)

This guide explains how to **configure** a simple Postgres table in Snap Cloud (Supabase) and **read/write** it from a Lens with the Supabase client.

**Prerequisite:** complete [**Getting started with Snap Cloud**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started) (plugin, project, credentials).

**Full product reference:** [**Snap Cloud documentation**](https://cloud.snap.com/docs).

---

## Configure the database

You will add a small table and **row-level security (RLS)** policies so each Snapchat-authenticated user can only read and write **their own** rows.

### Open the dashboard

1. In Lens Studio, open the **Supabase** plugin.
2. Click the **dashboard** icon for your project to open the [**Snap Cloud / Supabase dashboard**](https://cloud.snap.com/).

From there you can monitor the project and configure the backend.

### Create a table

1. In the sidebar, open **Table Editor**.
2. Click **New Table**.
3. Name the table as in the official walkthrough (the live doc uses **`test-table`**). **RLS** stays enabled by default.
4. Add columns (**Add column**):
   - **`user_id`** — type **`uuid`**, default **`auth.uid`**
   - **`message`** — type **`text`**
5. Save the table.

The default **`id`** column is kept for primary-key access in the sample scripts.

**Important:** Set the script **`tableName`** input (below) to the **exact** table name Supabase shows in the Table Editor. The TypeScript example defaults to **`test_table`**; if your table is named differently (e.g. with a hyphen), update the input so `.from(tableName)` matches.

### RLS policies

Still in **Table Editor**, open your table and add policies (**Add RLS policy** → **Create policy**). Use the Supabase templates:

1. **`Enable insert for users based on user_id`** — save.
2. **`Enable users to view their only data only`** — template wording on the dashboard may vary slightly; pick the policy that **restricts SELECT to the current user’s rows** (same intent as the official guide).

You want: users may **insert** rows tied to their **`user_id`**, and **select** only rows for their **`user_id`**. For **UPDATE** / **DELETE** in the sample code to succeed, add matching policies if the templates above do not already allow updates/deletes for own rows—see [RLS in the Supabase docs](https://supabase.com/docs/guides/auth/row-level-security) if operations fail with permission errors.

---

## Access the database

Use the Supabase client from your Lens. The examples below run **INSERT**, **SELECT**, **UPDATE**, and **DELETE** in sequence after sign-in. They extend the same auth pattern as the [Getting started](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started) guide.

### TypeScript

```typescript
import { createClient, SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud';

@component
export class DatabaseExample extends BaseScriptComponent {
  @input
  @hint('Supabase Project asset from Asset Browser')
  supabaseProject: SupabaseProject;

  @input
  @hint('Table name to use for database operations')
  tableName: string = 'test_table';

  private client: SupabaseClient;
  private uid: string;

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
        this.log('Running database examples...');
        await this.runDatabaseExamples();
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
      this.log('User authenticated: ' + this.uid);
    }
  }

  async runDatabaseExamples() {
    this.log('--- DATABASE EXAMPLES START ---');
    await this.testInsert();
    await this.delay(500);
    await this.testSelect();
    await this.delay(500);
    await this.testUpdate();
    await this.delay(500);
    await this.testDelete();
    this.log('--- DATABASE EXAMPLES COMPLETE ---');
  }

  async testInsert() {
    this.log('Testing INSERT operation...');
    const testMessage = 'Hello Supabase DB ' + Date.now();
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
      this.log('INSERT FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('INSERT SUCCESS - ID: ' + data[0].id);
      this.log('Message: ' + data[0].message);
    } else {
      this.log('INSERT FAILED: No data returned');
    }
  }

  async testSelect() {
    this.log('Testing SELECT operation...');
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', this.uid)
      .limit(3);
    if (error) {
      this.log('SELECT FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('SELECT SUCCESS - Found ' + data.length + ' records');
      data.forEach((record, index) => {
        this.log('  Record ' + (index + 1) + ': ' + record.message);
      });
    } else {
      this.log('SELECT SUCCESS - No records found');
    }
  }

  async testUpdate() {
    this.log('Testing UPDATE operation...');
    const { data: selectData, error: selectError } = await this.client
      .from(this.tableName)
      .select('id')
      .eq('user_id', this.uid)
      .limit(1);
    if (selectError || !selectData || selectData.length === 0) {
      this.log('UPDATE SKIPPED: No records to update');
      return;
    }
    const recordId = selectData[0].id;
    const updatedMessage = 'Updated message ' + Date.now();
    const { data, error } = await this.client
      .from(this.tableName)
      .update({
        message: updatedMessage,
      })
      .eq('id', recordId)
      .select();
    if (error) {
      this.log('UPDATE FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('UPDATE SUCCESS - ID: ' + data[0].id);
      this.log('New message: ' + data[0].message);
    } else {
      this.log('UPDATE FAILED: No data returned');
    }
  }

  async testDelete() {
    this.log('Testing DELETE operation...');
    const { data: selectData, error: selectError } = await this.client
      .from(this.tableName)
      .select('id')
      .eq('user_id', this.uid)
      .limit(1);
    if (selectError || !selectData || selectData.length === 0) {
      this.log('DELETE SKIPPED: No records to delete');
      return;
    }
    const recordId = selectData[0].id;
    const { data, error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', recordId)
      .select();
    if (error) {
      this.log('DELETE FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('DELETE SUCCESS - Deleted ID: ' + data[0].id);
    } else {
      this.log('DELETE FAILED: No data returned');
    }
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
    if (this.client) {
      this.client.removeAllChannels();
    }
  }

  private log(message: string) {
    print('[DatabaseExample] ' + message);
  }
}
```

### JavaScript

```javascript
const createClient =
  require('SupabaseClient.lspkg/supabase-snapcloud').createClient;

//@input Asset.SupabaseProject supabaseProject {"hint":"Supabase Project asset from Asset Browser"}
//@input string tableName = "test_table" {"hint":"Table name to use for database operations"}

/**
 * Database CRUD example (JavaScript): INSERT, SELECT, UPDATE, DELETE.
 */
var DatabaseExampleJS = function () {
  this.client = null;
  this.uid = null;

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
        this.log('Running database examples...');
        await this.runDatabaseExamples();
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
      this.log('User authenticated: ' + this.uid);
    }
  };

  this.runDatabaseExamples = async function () {
    this.log('--- DATABASE EXAMPLES START ---');
    await this.testInsert();
    await this.delay(500);
    await this.testSelect();
    await this.delay(500);
    await this.testUpdate();
    await this.delay(500);
    await this.testDelete();
    this.log('--- DATABASE EXAMPLES COMPLETE ---');
  };

  this.testInsert = async function () {
    this.log('Testing INSERT operation...');
    const testMessage = 'Hello Supabase DB ' + Date.now();
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
      this.log('INSERT FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('INSERT SUCCESS - ID: ' + data[0].id);
      this.log('Message: ' + data[0].message);
    } else {
      this.log('INSERT FAILED: No data returned');
    }
  };

  this.testSelect = async function () {
    this.log('Testing SELECT operation...');
    const { data, error } = await this.client
      .from(script.tableName)
      .select('*')
      .eq('user_id', this.uid)
      .limit(3);
    if (error) {
      this.log('SELECT FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('SELECT SUCCESS - Found ' + data.length + ' records');
      data.forEach((record, index) => {
        this.log('  Record ' + (index + 1) + ': ' + record.message);
      });
    } else {
      this.log('SELECT SUCCESS - No records found');
    }
  };

  this.testUpdate = async function () {
    this.log('Testing UPDATE operation...');
    const { data: selectData, error: selectError } = await this.client
      .from(script.tableName)
      .select('id')
      .eq('user_id', this.uid)
      .limit(1);
    if (selectError || !selectData || selectData.length === 0) {
      this.log('UPDATE SKIPPED: No records to update');
      return;
    }
    const recordId = selectData[0].id;
    const updatedMessage = 'Updated message ' + Date.now();
    const { data, error } = await this.client
      .from(script.tableName)
      .update({
        message: updatedMessage,
      })
      .eq('id', recordId)
      .select();
    if (error) {
      this.log('UPDATE FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('UPDATE SUCCESS - ID: ' + data[0].id);
      this.log('New message: ' + data[0].message);
    } else {
      this.log('UPDATE FAILED: No data returned');
    }
  };

  this.testDelete = async function () {
    this.log('Testing DELETE operation...');
    const { data: selectData, error: selectError } = await this.client
      .from(script.tableName)
      .select('id')
      .eq('user_id', this.uid)
      .limit(1);
    if (selectError || !selectData || selectData.length === 0) {
      this.log('DELETE SKIPPED: No records to delete');
      return;
    }
    const recordId = selectData[0].id;
    const { data, error } = await this.client
      .from(script.tableName)
      .delete()
      .eq('id', recordId)
      .select();
    if (error) {
      this.log('DELETE FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.length > 0) {
      this.log('DELETE SUCCESS - Deleted ID: ' + data[0].id);
    } else {
      this.log('DELETE FAILED: No data returned');
    }
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
    if (this.client) {
      this.client.removeAllChannels();
    }
  };

  this.log = function (message) {
    print('[DatabaseExampleJS] ' + message);
  };
};

var instance = new DatabaseExampleJS();
instance.onAwake();
```

When you run the Lens, operations run in order and results appear in the Logger. The **Table Editor** in the dashboard should reflect inserts/updates/deletes in near real time.

---

## Next steps

- More database features: [**Snap Cloud docs**](https://cloud.snap.com/docs) (SQL, RLS, migrations, etc.).
- Other Snap Cloud surfaces on Snap for Developers: [**Edge functions**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/edge-functions), [**Storage**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/storage), [**Realtime**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/realtime).
