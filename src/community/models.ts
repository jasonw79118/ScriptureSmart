export interface ChurchSourceItem {
  sourceUrl: string;
  sourceType: 'website' | 'favicon' | 'open-graph' | 'feed' | 'manual';
  title: string;
  imageUrl?: string;
  lastCheckedAt?: string;
}
export interface ChurchSource {
  churchId: string;
  websiteUrl: string;
  logoUrl?: string;
  imageUrl?: string;
  lastSyncedAt?: string;
  items?: ChurchSourceItem[];
}
export interface ChurchIdentity {
  id: string;
  name: string;
  city: string;
  website_url?: string;
  image_url?: string;
  group_label: string;
  group_label_plural: string;
  accent: string;
  welcome: string;
  leaders: string;
  owner_id: string;
}
export interface CommunityGroup {
  discovery?: DiscoveryProfile;
  id: string;
  church_id: string;
  name: string;
  description: string;
  rhythm: string;
  location: string;
  address: string;
  directions: string;
  timezone: string;
  meals_enabled: boolean;
  kids_enabled: boolean;
  hosts: string;
  age_range: string;
}
export interface Member {
  group_id: string;
  user_id: string;
  display_name: string;
  role: 'leader' | 'member' | 'guest';
  capabilities?: Record<CapabilityKey, boolean>;
}
export interface Gathering {
  id: string;
  group_id: string;
  title: string;
  date: string;
  time: string;
  meal_theme: string;
  meal_notes: string;
  kids_plan: string;
}
export interface Attendance {
  meeting_id: string;
  user_id: string;
  status: 'going' | 'maybe' | 'not-going';
  adults: number;
  kids: number;
}
export interface Dish {
  id: string;
  meeting_id: string;
  name: string;
  details: string;
  assignee_id: string | null;
  category?: 'main' | 'side' | 'dessert' | 'supplies';
  allergens?: string[];
  ingredients?: string;
  ingredient_status?: 'unverified' | 'provided';
}
export interface DietaryNeed {
  id: string;
  group_id: string;
  user_id: string;
  person: string;
  kind: 'allergy' | 'sensitivity';
  foods: string[];
  notes: string;
  consent: boolean;
}
export interface Contribution {
  id: string;
  group_id: string;
  author_id: string;
  kind: 'question' | 'idea' | 'discussion' | 'kids';
  text: string;
  parent_id: string | null;
  created_at: string;
}
export interface CommunityData {
  church_sources?: ChurchSource[];
  church_members: ChurchMember[];
  directory: GroupListing[];
  churches: ChurchIdentity[];
  groups: CommunityGroup[];
  members: Member[];
  meetings: Gathering[];
  attendance: Attendance[];
  dishes: Dish[];
  contributions: Contribution[];
  dietary: DietaryNeed[];
}
export type Collection = Exclude<keyof CommunityData, 'church_sources'>;
export type Row = CommunityData[Collection][number];
export const emptyCommunity: CommunityData = {
  church_sources: [],
  church_members: [],
  directory: [],
  churches: [],
  groups: [],
  members: [],
  meetings: [],
  attendance: [],
  dishes: [],
  contributions: [],
  dietary: [],
};
export const redeemer = {
  name: 'Redeemer Christian Church',
  city: 'Amarillo, TX',
  group_label: 'Gospel Community Group',
  group_label_plural: 'Gospel Community Groups',
  accent: '#363636',
  welcome: 'Life together, rooted in the gospel.',
  website_url: 'https://www.redeemerchristianchurch.com/',
  leaders: '',
};
export const previewCommunity: CommunityData = {
  ...emptyCommunity,
  churches: [
    { ...redeemer, id: 'redeemer-preview', owner_id: 'local-preview' },
  ],
  church_sources: [
    {
      churchId: 'redeemer-preview',
      websiteUrl: 'https://www.redeemerchristianchurch.com/',
      lastSyncedAt: '',
      items: [],
    },
  ],
  groups: [
    {
      id: 'gcg-preview',
      church_id: 'redeemer-preview',
      name: 'Williams Group',
      discovery: {
        listed: true,
        accepting: true,
        neighborhood: 'Canyon',
        households: ['single', 'married', 'other'],
        latitude: null,
        longitude: null,
        leader_name: 'Jason Williams',
        email: '',
        phone: '',
        preferred_contact: '',
        contact_visible: true,
      },
      description:
        'Families growing together in the gospel, with children ages 0–14.',
      rhythm: 'Sundays at 4:00 p.m.',
      hosts: 'Jason and Ryanne Williams',
      age_range: '0–14 years',
      location: 'Williams home',
      address: import.meta.env.DEV ? '13851 Hale Rd, Canyon, TX 79015' : '',
      directions: '',
      timezone: 'America/Chicago',
      meals_enabled: true,
      kids_enabled: true,
    },
  ],
  members: [
    {
      group_id: 'gcg-preview',
      user_id: 'local-preview',
      display_name: 'Jason Williams (local preview)',
      role: 'leader',
    },
  ],
};
export type ModuleKey =
  | 'study'
  | 'sermons'
  | 'bible-studies'
  | 'guide'
  | 'research'
  | 'library'
  | 'groups'
  | 'discussion'
  | 'meals'
  | 'kids';
export type CapabilityKey = 'discussion' | 'meals' | 'kids';
export interface ChurchMember {
  church_id: string;
  user_id: string;
  display_name: string;
  status: 'pending' | 'approved' | 'declined' | 'suspended';
  modules: Record<ModuleKey, boolean>;
}
export interface DiscoveryProfile {
  listed: boolean;
  accepting: boolean;
  neighborhood: string;
  households: string[];
  latitude: number | null;
  longitude: number | null;
  leader_name: string;
  email: string;
  phone: string;
  preferred_contact: '' | 'email' | 'text' | 'phone';
  contact_visible: boolean;
}
export interface GroupListing {
  id: string;
  church_id: string;
  name: string;
  description: string;
  rhythm: string;
  age_range: string;
  kids_enabled: boolean;
  neighborhood: string;
  households: string[];
  latitude: number | null;
  longitude: number | null;
  leader_name: string;
  email: string;
  phone: string;
  preferred_contact: string;
  accepting: boolean;
}
