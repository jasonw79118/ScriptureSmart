// Server-only contracts. These are intentionally not imported into src/.
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
}
export interface StoredConnection {
  id: string;
  ownerId: string;
  providerId: string;
  credentialReference: string;
  createdAt: string;
  lastVerifiedAt?: string;
}
export interface SecretVault {
  put(
    owner: AuthenticatedPrincipal,
    providerId: string,
    secret: string,
  ): Promise<string>;
  revoke(
    owner: AuthenticatedPrincipal,
    credentialReference: string,
  ): Promise<void>;
}
export interface MembershipAuthorizer {
  requireGroupAccess(
    principal: AuthenticatedPrincipal,
    groupId: string,
    operation: 'read' | 'post' | 'manage',
  ): Promise<void>;
  requireChurchAdmin(
    principal: AuthenticatedPrincipal,
    churchId: string,
  ): Promise<void>;
}
export interface DraftRepository<T> {
  listOwned(principal: AuthenticatedPrincipal): Promise<T[]>;
  saveOwned(principal: AuthenticatedPrincipal, draft: T): Promise<T>;
}
