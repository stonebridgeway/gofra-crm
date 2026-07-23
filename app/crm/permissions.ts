import type {
  AppModule,
  CrmSnapshot,
  OwnedEntity,
  User,
  UserRole,
} from "./domain";

export type Permission =
  | "records:view-own"
  | "records:view-team"
  | "records:assign"
  | "financials:view"
  | "calendar:view-own"
  | "calendar:view-team"
  | "statistics:view-own"
  | "statistics:view-team"
  | "targets:manage"
  | "chat:use"
  | "data:import"
  | "dictionaries:manage"
  | "team:manage";

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  employee: new Set<Permission>([
    "records:view-own",
    "calendar:view-own",
    "statistics:view-own",
    "chat:use",
  ]),
  manager: new Set<Permission>([
    "records:view-own",
    "records:view-team",
    "records:assign",
    "financials:view",
    "calendar:view-own",
    "calendar:view-team",
    "statistics:view-own",
    "statistics:view-team",
    "targets:manage",
    "chat:use",
    "data:import",
    "dictionaries:manage",
    "team:manage",
  ]),
};

const MANAGER_ONLY_MODULES = new Set<AppModule>(["import", "dictionaries"]);

export const isManager = (user: User): boolean => user.role === "manager";

export const hasPermission = (
  user: User,
  permission: Permission,
): boolean => ROLE_PERMISSIONS[user.role].has(permission);

export const getCurrentUser = (snapshot: CrmSnapshot): User => {
  const user = snapshot.users.find(
    (candidate) => candidate.id === snapshot.session.currentUserId,
  );

  if (!user) {
    throw new Error("Текущий пользователь не найден в снимке CRM.");
  }

  return user;
};

export const getActiveTeamUsers = (
  snapshot: Pick<CrmSnapshot, "session" | "users">,
): User[] =>
  snapshot.users.filter(
    (user) =>
      user.isActive && user.teamId === snapshot.session.activeTeamId,
  );

export const canAccessModule = (
  user: User,
  module: AppModule,
): boolean => !MANAGER_ONLY_MODULES.has(module) || isManager(user);

export const canViewUser = (
  actor: User,
  subject: User,
): boolean =>
  actor.id === subject.id ||
  (isManager(actor) && actor.teamId === subject.teamId);

export const canAccessOwner = (
  actor: User,
  ownerId: string,
  users: readonly User[],
): boolean => {
  if (actor.id === ownerId) return true;
  if (!isManager(actor)) return false;

  const owner = users.find((user) => user.id === ownerId);
  return Boolean(owner && owner.teamId === actor.teamId);
};

export const canViewRecord = (
  actor: User,
  record: Pick<OwnedEntity, "ownerId">,
  users: readonly User[],
): boolean => canAccessOwner(actor, record.ownerId, users);

export const canEditRecord = canViewRecord;

export const canDeleteRecord = (
  actor: User,
  record: Pick<OwnedEntity, "ownerId">,
  users: readonly User[],
): boolean => canAccessOwner(actor, record.ownerId, users);

export const canAssignOwner = (
  actor: User,
  nextOwnerId: string,
  users: readonly User[],
): boolean => {
  if (!isManager(actor)) return nextOwnerId === actor.id;

  const nextOwner = users.find((user) => user.id === nextOwnerId);
  return Boolean(nextOwner && nextOwner.teamId === actor.teamId);
};

export const canViewFinancials = (user: User): boolean =>
  hasPermission(user, "financials:view");

export const canManageTargets = (user: User): boolean =>
  hasPermission(user, "targets:manage");

export const canManageDictionaries = (user: User): boolean =>
  hasPermission(user, "dictionaries:manage");

export const canImportData = (user: User): boolean =>
  hasPermission(user, "data:import");

export const filterAccessibleRecords = <
  T extends Pick<OwnedEntity, "ownerId">,
>(
  actor: User,
  records: readonly T[],
  users: readonly User[],
): T[] =>
  records.filter((record) => canViewRecord(actor, record, users));

