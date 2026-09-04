import { ObjectId } from "mongodb";

// One protected identity profile per user (Phase 2.0 M1) — the information
// the CV discovery service will eventually search against. Reference photos
// stay on the existing Reference Media screen and are not duplicated here.
export interface IdentityProfileDoc {
  _id?: ObjectId;
  userId: ObjectId;
  fullName: string;
  usernames: string[];
  aliases: string[];
  websites: string[];
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}
