# Edge functions (Snap Cloud)

> **Canonical reference:** [Edge functions | Snap for Developers](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/edge-functions)

**Edge functions** are serverless functions that run when your Lens calls them. They are deployed at the **edge** of the network (close to the user), which helps **latency** and performance for a global audience.

**Prerequisite:** complete [**Getting started with Snap Cloud**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started).

**Full product reference:** [**Snap Cloud documentation**](https://cloud.snap.com/docs).

---

## Configure an edge function

This walkthrough deploys a small function named **`sum`** that adds two numbers.

1. Open the [**Snap Cloud / Supabase dashboard**](https://cloud.snap.com/).
2. Go to **Edge Functions**.
3. Choose **Deploy a new function** → **Via Editor**.

Functions are written in **TypeScript** on [**Deno**](https://deno.com/learn/serverless-functions). Import the Supabase runtime types, then handle HTTP in `Deno.serve`.

### Example: `sum` (Deno / Supabase Edge Function)

```typescript
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve(async (req) => {
  const { num1, num2 } = await req.json();
  const sum = num1 + num2;
  const data = { sum };
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
  });
});
```

Paste the code into the editor, name the function **`sum`**, and click **Deploy Function**. After deploy, the function is live for your project.

---

## Invoke an edge function from Lens Studio

Use the same **Supabase client** (`SupabaseClient.lspkg`) as in the getting started guide. Call **`client.functions.invoke(functionName, { body })`** and handle `data` / `error`.

### TypeScript

```typescript
import { createClient, SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud';

@component
export class EdgeFunctionExample extends BaseScriptComponent {
  @input
  @hint('Supabase Project asset from Asset Browser')
  supabaseProject: SupabaseProject;

  @input
  @hint('Edge Function name deployed in your Supabase project')
  functionName: string = 'sum';

  @input
  @hint('First number to add')
  num1: number = 10;

  @input
  @hint('Second number to add')
  num2: number = 25;

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
        this.log('Calling Edge Function...');
        await this.callEdgeFunction();
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

  async callEdgeFunction() {
    this.log('--- EDGE FUNCTION EXAMPLE START ---');
    this.log('Calling function: ' + this.functionName);
    this.log('Input: num1=' + this.num1 + ', num2=' + this.num2);
    try {
      const { data, error } = await this.client.functions.invoke(
        this.functionName,
        {
          body: {
            num1: this.num1,
            num2: this.num2,
          },
        }
      );
      if (error) {
        this.log('FUNCTION CALL FAILED: ' + JSON.stringify(error));
        return;
      }
      if (data) {
        this.log('FUNCTION CALL SUCCESS');
        this.log('Result: ' + JSON.stringify(data));
        if (data.sum !== undefined) {
          const result = this.num1 + ' + ' + this.num2 + ' = ' + data.sum;
          this.log('Calculation: ' + result);
        }
      }
    } catch (err) {
      this.log('Exception calling function: ' + err);
    }
    this.log('--- EDGE FUNCTION EXAMPLE COMPLETE ---');
  }

  public async invokeFunction(fn: string, params: any) {
    if (!this.client) {
      this.log('Client not initialized');
      return null;
    }
    const { data, error } = await this.client.functions.invoke(fn, {
      body: params,
    });
    if (error) {
      this.log('Function error: ' + JSON.stringify(error));
      return null;
    }
    return data;
  }

  onDestroy() {
    if (this.client) {
      this.client.removeAllChannels();
    }
  }

  private log(message: string) {
    print('[EdgeFunctionExample] ' + message);
  }
}
```

### JavaScript

```javascript
const createClient =
  require('SupabaseClient.lspkg/supabase-snapcloud').createClient;

//@input Asset.SupabaseProject supabaseProject {"hint":"Supabase Project asset from Asset Browser"}
//@input string functionName = "sum" {"hint":"Edge Function name deployed in your Supabase project"}
//@input float num1 = 10 {"hint":"First number to add"}
//@input float num2 = 25 {"hint":"Second number to add"}

/**
 * Edge Function example (JavaScript): invoke a deployed Supabase Edge Function.
 */
var EdgeFunctionExampleJS = function () {
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
        this.log('Calling Edge Function...');
        await this.callEdgeFunction();
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

  this.callEdgeFunction = async function () {
    this.log('--- EDGE FUNCTION EXAMPLE START ---');
    this.log('Calling function: ' + script.functionName);
    this.log('Input: num1=' + script.num1 + ', num2=' + script.num2);
    try {
      const { data, error } = await this.client.functions.invoke(
        script.functionName,
        {
          body: {
            num1: script.num1,
            num2: script.num2,
          },
        }
      );
      if (error) {
        this.log('FUNCTION CALL FAILED: ' + JSON.stringify(error));
        return;
      }
      if (data) {
        this.log('FUNCTION CALL SUCCESS');
        this.log('Result: ' + JSON.stringify(data));
        if (data.sum !== undefined) {
          const result = script.num1 + ' + ' + script.num2 + ' = ' + data.sum;
          this.log('Calculation: ' + result);
        }
      }
    } catch (err) {
      this.log('Exception calling function: ' + err);
    }
    this.log('--- EDGE FUNCTION EXAMPLE COMPLETE ---');
  };

  this.invokeFunction = async function (fn, params) {
    if (!this.client) {
      this.log('Client not initialized');
      return null;
    }
    const { data, error } = await this.client.functions.invoke(fn, {
      body: params,
    });
    if (error) {
      this.log('Function error: ' + JSON.stringify(error));
      return null;
    }
    return data;
  };

  this.onDestroy = function () {
    if (this.client) {
      this.client.removeAllChannels();
    }
  };

  this.log = function (message) {
    print('[EdgeFunctionExampleJS] ' + message);
  };
};

var instance = new EdgeFunctionExampleJS();
instance.onAwake();
```

With the default inputs (**10** and **25**), a successful run should log something like **`10 + 25 = 35`**.

---

## Next steps

- More edge function patterns: [**Snap Cloud docs**](https://cloud.snap.com/docs).
- Other Snap Cloud topics: [**Storage**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/storage), [**Realtime**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/realtime), [**Databases**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/databases).
