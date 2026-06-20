export type Role = "admin" | "user" | "guest";

export type ClaimStatus =
  | "unverified"
  | "investigating"
  | "confirmed"
  | "debunked"
  | "disputed"
  | "archived";

export type Visibility = "public" | "private";
export type VoteType = "upvote" | "downvote";

export interface Profile {
  id: string;
  role_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  status: ClaimStatus;
  estimated_origin_at: string | null;
  category_id: string | null;
  source_url: string | null;
  source_type: "link" | "document" | "image" | "text" | "other" | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles?: Pick<Profile, "display_name" | "username" | "avatar_url">;
  categories?: { name: string } | null;
}

export interface Evidence {
  id: string;
  claim_id: string;
  platform_id: string | null;
  title: string | null;
  content: string | null;
  evidence_url: string | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  platforms?: { name: string; slug: string; icon_url: string | null } | null;
}

export interface Platform {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Tag {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Comment {
  id: string;
  claim_id: string | null;
  evidence_id: string | null;
  parent_comment_id: string | null;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles?: Pick<Profile, "display_name" | "username" | "avatar_url">;
  replies?: Comment[];
}

export interface ClaimVote {
  id: string;
  claim_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface ClaimTag {
  claim_id: string;
  tag_id: string;
  added_by: string | null;
}
