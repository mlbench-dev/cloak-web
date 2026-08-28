import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebaseAdmin";

// Kept separate from lib/firebaseAdmin.ts on purpose — see the comment
// there. Only app/api/firebase/custom-token/route.ts should import this.
export function getAdminAuth() {
  return getAuth(getAdminApp());
}
