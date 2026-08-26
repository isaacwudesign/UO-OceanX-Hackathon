# Getting started with Snap Cloud

> **Canonical reference:** [Getting started | Snap for Developers](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started)

This guide shows how to set up a Lens to use a [**Snap Cloud**](https://cloud.snap.com/) backend: configure a project and authenticate users. After this, continue with the [**Databases**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/databases) guide to configure and query a simple database.

For full API and product reference, use the [**Snap Cloud documentation site**](https://cloud.snap.com/docs) (Supabase-powered).

---

## Alpha

[**Snap Cloud**](https://cloud.snap.com/) powered by Supabase is currently in **alpha**. [**Apply for the alpha program**](https://snap-ar.com/SnapCloudApplication) to use Snap Cloud with Spectacles projects.

---

## Install the Supabase asset and Supabase plugin

1. Open the **Asset Library** in Lens Studio and install:
   - **SupabaseClient** — ships the [supabase-js](https://github.com/supabase/supabase-js) client configured for Lens Studio (used for all Supabase API calls).
   - **Supabase plugin** — UI to manage Snap Cloud / Supabase projects.

2. Open the plugin via **Window** → **Supabase** (wording may match your Lens Studio version). It lists your projects and **provides** actions such as creating projects and opening the Supabase dashboard.

3. The first time you open the plugin, **log in** if prompted. Ensure your account has completed [**email verification**](https://help.snapchat.com/hc/en-us/articles/7012350653460-How-do-I-change-or-verify-my-email-address-on-Snapchat) before relying on login.

---

## Create a new project

- If you have **no organizations** and **no projects** (typical first run), a **default organization** is created for you.
- If you have **multiple organizations**, pick one from the drop-down.

Click **Create a New Project**, enter a **project name** and **database password**. Initialization can take about a minute.

---

## Start developing your Lens

### Connect your Lens to Supabase

1. Add the **SupabaseClient** asset to your Lens project (from the Asset Library).

2. Add a script that authenticates the wearer with Supabase. In outline:

   - **Import** the client:  
     `import { createClient, SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud'`
   - In the **Supabase plugin**, under the project you want, click **Import Credentials** to create a **Supabase Project** asset.
   - In the script, add an input (TypeScript example):  
     `@input supabaseProject: SupabaseProject`  
     and assign the imported **Supabase Project** asset in the Inspector.
   - Call  
     `createClient(this.supabaseProject.url, this.supabaseProject.publicToken)`  
     (TypeScript) or the equivalent with your script’s project reference (JavaScript) to obtain the client you use for Supabase calls.

3. Sign in with Snapchat using `client.auth.signInWithIdToken` as in the examples below. Follow the official guide for the exact parameters your Lens Studio / Spectacles build expects.

---

### Example: TypeScript

```typescript
import { createClient, SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud';

@component
export class MyComponent extends BaseScriptComponent {
  @input supabaseProject: SupabaseProject;
  private client: SupabaseClient;
  private uid;

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => {
      this.onStart();
    });
  }

  onStart() {
    this.initSupabase();
  }

  async initSupabase() {
    print('Initializing Supabase client...');
    print('Project URL: ' + this.supabaseProject.url);
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
    if (this.client) {
      print('Supabase client created successfully');
      await this.signInUser();
    } else {
      print('Failed to create Supabase client');
    }
  }

  async signInUser() {
    print('Attempting to sign in...');
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: 'snapchat',
      token: '',
    });
    if (error) {
      print('Sign in FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.user) {
      const { user, session } = data;
      this.uid = JSON.stringify(user.id).replace(/^"(.*)"$/, '$1');
      print('Sign in SUCCESS!');
      print('User ID: ' + this.uid);
      print('User Email: ' + (user.email || 'N/A'));
      if (session) {
        print('Session Active: YES');
        print(
          'Access Token (first 20 chars): ' +
            session.access_token.substring(0, 20) +
            '...'
        );
        print('Token Type: ' + session.token_type);
        print(
          'Expires At: ' + new Date(session.expires_at * 1000).toISOString()
        );
      } else {
        print('Session: No session data');
      }
      print('Authentication verified and ready!');
    } else {
      print('Sign in completed but no user data returned');
    }
  }

  onDestroy() {
    if (this.client) {
      this.client.removeAllChannels();
    }
  }
}
```

---

### Example: JavaScript

```javascript
// Import Supabase client
const createClient =
  require('SupabaseClient.lspkg/supabase-snapcloud').createClient;

//@input Asset.SupabaseProject supabaseProject

/**
 * Getting Started with Supabase in Lens Studio (JavaScript)
 * Basic setup to connect and sign in.
 */
var GettingStarted = function () {
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
    print('Initializing Supabase client...');
    print('Project URL: ' + script.supabaseProject.url);
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
      print('Supabase client created successfully');
      await this.signInUser();
    } else {
      print('Failed to create Supabase client');
    }
  };

  this.signInUser = async function () {
    print('Attempting to sign in...');
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: 'snapchat',
      token: '',
    });
    if (error) {
      print('Sign in FAILED: ' + JSON.stringify(error));
      return;
    }
    if (data && data.user) {
      const user = data.user;
      const session = data.session;
      this.uid = JSON.stringify(user.id).replace(/^"(.*)"$/, '$1');
      print('Sign in SUCCESS!');
      print('User ID: ' + this.uid);
      print('User Email: ' + (user.email || 'N/A'));
      if (session) {
        print('Session Active: YES');
        print(
          'Access Token (first 20 chars): ' +
            session.access_token.substring(0, 20) +
            '...'
        );
        print('Token Type: ' + session.token_type);
        print(
          'Expires At: ' + new Date(session.expires_at * 1000).toISOString()
        );
      } else {
        print('Session: No session data');
      }
      print('Authentication verified and ready!');
    } else {
      print('Sign in completed but no user data returned');
    }
  };

  this.onDestroy = function () {
    if (this.client) {
      this.client.removeAllChannels();
    }
  };
};

var instance = new GettingStarted();
instance.onAwake();
```

---

## Sample projects

Snap provides [**Snap Cloud sample projects**](https://github.com/specs-devs/samples/tree/main/Snap%20Cloud) that show common integration patterns. You can:

- Clone or download from the [**specs-devs/samples** repository](https://github.com/specs-devs/samples), or  
- Open them from **Lens Studio’s Home** page when available.

Import your Supabase project credentials into the sample the same way as above, then explore. Next step: [**Databases**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/databases). For everything Snap Cloud can do, keep the [**Snap Cloud docs**](https://cloud.snap.com/docs) open.
