import crypto from "crypto";
import axios from "axios";

/**
 * Credential checks for admin integrations: each provider is verified with an
 * authenticated, read-only API call. Returns { success, message, httpStatus?, status }
 * where status is "healthy" | "unhealthy" | "unknown".
 *
 * Credential conventions (AdminIntegration.credentials):
 *   apiKey / secretKey / accessToken, plus `extra` for provider-specific values
 *   (e.g. extra.cloudName, extra.measurementId, extra.region). config.baseUrl is
 *   used by Salesforce (instance URL), Discord webhooks and generic providers.
 */

const TIMEOUT = 10000;

const get = (url, config = {}) => axios.get(url, { timeout: TIMEOUT, validateStatus: () => true, ...config });
const post = (url, data, config = {}) => axios.post(url, data, { timeout: TIMEOUT, validateStatus: () => true, ...config });
const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const extraOf = (integration) => {
  const extra = integration.credentials?.extra;
  if (!extra) return {};
  return extra instanceof Map ? Object.fromEntries(extra) : extra;
};
const settingsOf = (integration) => {
  const s = integration.config?.settings;
  if (!s) return {};
  return s instanceof Map ? Object.fromEntries(s) : s;
};

const missing = (field) => ({ success: false, status: "unhealthy", message: `Missing credential: ${field}` });

const fromResponse = (res, ok, label) => {
  const success = ok(res);
  const detail = res.data?.message || res.data?.error?.message || res.data?.error || res.data?.errors?.[0]?.message;
  return {
    success,
    status: success ? "healthy" : "unhealthy",
    httpStatus: res.status,
    message: success
      ? `${label} credentials verified`
      : `${label} rejected the request (HTTP ${res.status}${detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""})`,
  };
};

/** Minimal AWS Signature V4 for a GET request. */
export const signAwsGet = ({
  host,
  path = "/",
  region,
  service,
  accessKeyId,
  secretAccessKey,
  date = new Date(),
  includeContentSha = true, // S3 requires x-amz-content-sha256
}) => {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update("").digest("hex");
  const canonicalHeaders = includeContentSha
    ? `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    : `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = includeContentSha ? "host;x-amz-content-sha256;x-amz-date" : "host;x-amz-date";
  const canonicalRequest = ["GET", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    "x-amz-date": amzDate,
    ...(includeContentSha ? { "x-amz-content-sha256": payloadHash } : {}),
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

const PROVIDER_TESTS = {
  stripe: async ({ credentials: c }) => {
    const key = c.secretKey || c.apiKey;
    if (!key) return missing("secretKey");
    return fromResponse(await get("https://api.stripe.com/v1/balance", bearer(key)), (r) => r.status === 200, "Stripe");
  },

  flutterwave: async ({ credentials: c }) => {
    if (!c.secretKey) return missing("secretKey");
    return fromResponse(
      await get("https://api.flutterwave.com/v3/balances", bearer(c.secretKey)),
      (r) => r.status === 200 && r.data?.status === "success",
      "Flutterwave"
    );
  },

  paystack: async ({ credentials: c }) => {
    if (!c.secretKey) return missing("secretKey");
    return fromResponse(
      await get("https://api.paystack.co/balance", bearer(c.secretKey)),
      (r) => r.status === 200 && r.data?.status === true,
      "Paystack"
    );
  },

  sendgrid: async ({ credentials: c }) => {
    const key = c.apiKey || c.secretKey;
    if (!key) return missing("apiKey");
    return fromResponse(await get("https://api.sendgrid.com/v3/scopes", bearer(key)), (r) => r.status === 200, "SendGrid");
  },

  twilio: async ({ credentials: c, extra }) => {
    const sid = extra.accountSid || c.apiKey;
    const token = c.secretKey || c.accessToken;
    if (!sid) return missing("apiKey (Account SID)");
    if (!token) return missing("secretKey (Auth Token)");
    return fromResponse(
      await get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
        auth: { username: sid, password: token },
      }),
      (r) => r.status === 200,
      "Twilio"
    );
  },

  firebase: async ({ credentials: c }) => {
    if (!c.secretKey) return missing("secretKey (service account JSON)");
    let account;
    try {
      account = JSON.parse(c.secretKey);
    } catch {
      return { success: false, status: "unhealthy", message: "secretKey must be the service account JSON" };
    }
    if (!account.client_email || !account.private_key) {
      return { success: false, status: "unhealthy", message: "Service account JSON is missing client_email/private_key" };
    }
    try {
      const { getFcmAccessToken } = await import("./notification-delivery.service.js");
      await getFcmAccessToken(account, { useCache: false });
      return { success: true, status: "healthy", message: "Firebase service account verified" };
    } catch (error) {
      return {
        success: false,
        status: "unhealthy",
        httpStatus: error.response?.status,
        message: `Firebase rejected the service account: ${error.response?.data?.error_description || error.message}`,
      };
    }
  },

  "google analytics": async ({ credentials: c, extra }) => {
    const measurementId = extra.measurementId || c.apiKey;
    const apiSecret = c.secretKey;
    if (!measurementId) return missing("apiKey (measurement ID)");
    if (!apiSecret) return missing("secretKey (API secret)");
    const res = await post(
      `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      { client_id: "confetti.integration-test", events: [{ name: "integration_test" }] }
    );
    const issues = res.data?.validationMessages || [];
    return {
      success: res.status === 200 && issues.length === 0,
      status: res.status === 200 && issues.length === 0 ? "healthy" : "unhealthy",
      httpStatus: res.status,
      message: issues.length ? `Google Analytics validation: ${issues.map((i) => i.description).join("; ")}` : res.status === 200 ? "Google Analytics measurement ID accepted" : `Google Analytics returned HTTP ${res.status}`,
    };
  },

  mixpanel: async ({ credentials: c }) => {
    if (!c.apiKey) return missing("apiKey (service account username)");
    if (!c.secretKey) return missing("secretKey (service account secret)");
    return fromResponse(
      await get("https://mixpanel.com/api/app/me", { auth: { username: c.apiKey, password: c.secretKey } }),
      (r) => r.status === 200,
      "Mixpanel"
    );
  },

  "aws s3": async ({ credentials: c, extra }) => {
    if (!c.apiKey) return missing("apiKey (access key ID)");
    if (!c.secretKey) return missing("secretKey (secret access key)");
    const host = "s3.amazonaws.com";
    const headers = signAwsGet({ host, region: extra.region || "us-east-1", service: "s3", accessKeyId: c.apiKey, secretAccessKey: c.secretKey });
    const res = await get(`https://${host}/`, { headers, responseType: "text" });
    const code = typeof res.data === "string" ? res.data.match(/<Code>([^<]+)<\/Code>/)?.[1] : null;
    return {
      success: res.status === 200,
      status: res.status === 200 ? "healthy" : "unhealthy",
      httpStatus: res.status,
      message: res.status === 200 ? "AWS credentials verified (ListBuckets)" : `AWS rejected the credentials (HTTP ${res.status}${code ? `: ${code}` : ""})`,
    };
  },

  cloudinary: async ({ credentials: c, extra, settings }) => {
    const cloudName = extra.cloudName || settings.cloudName;
    if (!cloudName) return missing("extra.cloudName");
    if (!c.apiKey) return missing("apiKey");
    if (!c.secretKey) return missing("secretKey");
    return fromResponse(
      await get(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/usage`, {
        auth: { username: c.apiKey, password: c.secretKey },
      }),
      (r) => r.status === 200,
      "Cloudinary"
    );
  },

  slack: async ({ credentials: c }) => {
    const token = c.accessToken || c.apiKey;
    if (!token) return missing("accessToken (bot token)");
    const res = await post("https://slack.com/api/auth.test", null, bearer(token));
    return {
      success: res.status === 200 && res.data?.ok === true,
      status: res.data?.ok ? "healthy" : "unhealthy",
      httpStatus: res.status,
      message: res.data?.ok ? `Slack token verified (team ${res.data.team})` : `Slack rejected the token: ${res.data?.error || `HTTP ${res.status}`}`,
    };
  },

  discord: async ({ credentials: c, config }) => {
    // A webhook URL can be checked without a bot token
    if (config.baseUrl && /discord(app)?\.com\/api\/webhooks\//.test(config.baseUrl)) {
      return fromResponse(await get(config.baseUrl), (r) => r.status === 200, "Discord webhook");
    }
    const token = c.accessToken || c.apiKey;
    if (!token) return missing("accessToken (bot token) or config.baseUrl (webhook URL)");
    return fromResponse(
      await get("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bot ${token}` } }),
      (r) => r.status === 200,
      "Discord"
    );
  },

  hubspot: async ({ credentials: c }) => {
    const token = c.accessToken || c.apiKey;
    if (!token) return missing("accessToken (private app token)");
    return fromResponse(
      await get("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", bearer(token)),
      (r) => r.status === 200,
      "HubSpot"
    );
  },

  salesforce: async ({ credentials: c, config }) => {
    if (!config.baseUrl) return missing("config.baseUrl (instance URL)");
    if (!c.accessToken) return missing("accessToken");
    return fromResponse(
      await get(`${config.baseUrl.replace(/\/$/, "")}/services/data/`, bearer(c.accessToken)),
      (r) => r.status === 200,
      "Salesforce"
    );
  },
};

/** Generic reachability check for providers without a dedicated test. */
const reachability = async (baseUrl) => {
  const res = await axios.head(baseUrl, { timeout: TIMEOUT, validateStatus: () => true, maxRedirects: 3 });
  const up = res.status < 500;
  return {
    success: up,
    status: up ? "healthy" : "unhealthy",
    httpStatus: res.status,
    message: up ? `Endpoint reachable (HTTP ${res.status}); credentials not verified for this provider` : `Endpoint returned HTTP ${res.status}`,
  };
};

export const testIntegrationConnection = async (integration) => {
  const provider = String(integration.provider || "").trim().toLowerCase();
  const context = {
    credentials: integration.credentials || {},
    extra: extraOf(integration),
    settings: settingsOf(integration),
    config: integration.config || {},
  };
  try {
    if (PROVIDER_TESTS[provider]) return await PROVIDER_TESTS[provider](context);
    if (context.config.baseUrl) return await reachability(context.config.baseUrl);
    return {
      success: false,
      status: "unknown",
      message: `No connection test is available for "${integration.provider}"; set config.baseUrl to enable a reachability check`,
    };
  } catch (error) {
    return {
      success: false,
      status: "unhealthy",
      message: `Could not reach ${integration.provider}: ${error.code || error.message}`,
    };
  }
};

export const SUPPORTED_TEST_PROVIDERS = Object.keys(PROVIDER_TESTS);
