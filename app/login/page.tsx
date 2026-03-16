import { getOrSetCsrfToken } from "@/lib/csrf";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const csrfToken = await getOrSetCsrfToken();
  return <LoginForm csrfToken={csrfToken} />;
}
