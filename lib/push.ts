import { getPushTokenForFielder } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToFielder(
  fielderName: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const token = await getPushTokenForFielder(fielderName);
  if (!token) return false;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: "default",
        priority: "high",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Push] Expo API error:", res.status, text);
      return false;
    }

    const json = (await res.json()) as { data?: { status?: string }[] };
    const status = json.data?.[0]?.status;
    if (status === "error") {
      console.error("[Push] Expo delivery failed:", json);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Push] Failed to send:", e);
    return false;
  }
}
