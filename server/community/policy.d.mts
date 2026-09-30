import type {
  CommunityData,
  ChurchMember,
  GroupListing,
  ModuleKey,
  CapabilityKey,
} from '../../src/community/models';
export const moduleLabels: Record<ModuleKey, string>;
export const defaultModules: Record<ModuleKey, boolean>;
export const defaultCapabilities: Record<CapabilityKey, boolean>;
export function churchMember(
  data: CommunityData,
  userId: string,
): ChurchMember | undefined;
export function normalizeData(data: CommunityData): CommunityData;
export function approved(data: CommunityData, userId: string): boolean;
export function canModule(
  data: CommunityData,
  userId: string,
  key: string,
): boolean;
export function canGroup(
  data: CommunityData,
  userId: string,
  gid: string,
  key: CapabilityKey,
): boolean;
export function directoryEntry(
  group: CommunityData['groups'][number],
): GroupListing;
