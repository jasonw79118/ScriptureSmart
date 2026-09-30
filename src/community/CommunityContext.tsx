import {
  normalizeData,
  canModule as checkModule,
  canGroup as checkGroup,
  approved,
  directoryEntry,
  defaultModules,
} from '../../server/community/policy.mjs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { account, communityRequest, functionId, ID } from './client';
import {
  emptyCommunity,
  previewCommunity,
  type CommunityData,
  type Collection,
  type Row,
} from './models';
interface UserSession {
  user: { id: string; email: string };
}
function readPreview(): CommunityData {
  try {
    const raw = localStorage.getItem('ss.community.v2');
    if (!raw) return normalizeData(structuredClone(previewCommunity));
    const data = normalizeData(JSON.parse(raw));
    if (
      !Object.keys(emptyCommunity).every((k) =>
        Array.isArray(data[k as keyof CommunityData]),
      )
    )
      return normalizeData(structuredClone(previewCommunity));
    return data;
  } catch {
    return normalizeData(structuredClone(previewCommunity));
  }
}
function useCommunityState() {
  const [local, setLocal] = useState(readPreview);
  const [remote, setRemote] = useState<CommunityData>(emptyCommunity);
  const [session, setSession] = useState<UserSession | null>(null);
  const [authReady, setAuthReady] = useState(!account);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedChurch, setSelectedChurch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [phrase, setPhrase] = useState('');
  const request = useRef(0);
  const configured = !!account && !!functionId;
  const authConfigured = !!account;
  const userId = configured ? (session?.user.id ?? '') : 'local-preview';
  const data = configured ? remote : local;
  const reload = useCallback(async () => {
    if (!functionId) return;
    const generation = ++request.current;
    const result = await communityRequest('snapshot');
    if (generation === request.current) setRemote(result.data);
  }, []);
  useEffect(() => {
    if (!account) return;
    let active = true;
    account
      .get()
      .then((u) => {
        if (active) setSession({ user: { id: u.$id, email: u.email } });
      })
      .catch((e) => {
        if (active && e.code !== 401)
          setError(
            'Unable to check Appwrite session. Verify the web platform hostname and project settings.',
          );
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const invalidateRequests = useCallback(() => {
    request.current += 1;
  }, []);
  useEffect(() => {
    if (!session || !configured) return;
    const load = () => {
      void reload().catch((e) => setError(e.message));
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
      invalidateRequests();
    };
  }, [session, configured, reload, invalidateRequests]);
  const church =
    data.churches.find((ch) => ch.id === selectedChurch) ?? data.churches[0];
  const groups = data.groups.filter((g) => g.church_id === church?.id);
  const group = groups.find((g) => g.id === selectedGroup) ?? groups[0];
  const scopedData = {
    ...data,
    churches: church ? [church] : [],
    church_members: data.church_members.filter(
      (m) => m.church_id === church?.id,
    ),
  };
  const canModule = (key: string) => checkModule(scopedData, userId, key);
  const canGroup = (key: import('./models').CapabilityKey) =>
    !!group && checkGroup(scopedData, userId, group.id, key);
  const needsChurch = configured && !!session && !approved(scopedData, userId);
  const directory = configured
    ? data.directory.filter((g) => g.church_id === church?.id)
    : groups.filter((g) => g.discovery?.listed).map(directoryEntry);
  const isAdmin = !!church && church.owner_id === userId;
  const isLeader =
    isAdmin ||
    data.members.some(
      (m) =>
        m.group_id === group?.id && m.user_id === userId && m.role === 'leader',
    );
  async function run(action: () => Promise<void>, success = 'Saved.') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to save. Please try again.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function persist(next: CommunityData) {
    localStorage.setItem('ss.community.v2', JSON.stringify(next));
    setLocal(next);
  }
  async function save(collection: Collection, row: Row, insert = false) {
    return run(async () => {
      if (configured) {
        await communityRequest('save', {
          churchId: church?.id,
          collection,
          row,
          insert,
        });
        await reload();
      } else {
        const rows = data[collection] as Row[];
        persist({
          ...data,
          [collection]: insert
            ? [...rows, row]
            : rows.map((r) =>
                'id' in r && 'id' in row && r.id === row.id ? row : r,
              ),
        });
      }
    });
  }
  async function rsvp(row: CommunityData['attendance'][number]) {
    return run(async () => {
      if (configured) {
        await communityRequest('rsvp', { churchId: church?.id, row });
        await reload();
      } else
        persist({
          ...data,
          attendance: [
            ...data.attendance.filter(
              (a) =>
                a.meeting_id !== row.meeting_id || a.user_id !== row.user_id,
            ),
            row,
          ],
        });
    }, 'Your attendance response is saved.');
  }
  async function assignDish(dishId: string, assignee: string | null) {
    return run(
      async () => {
        if (configured) {
          await communityRequest('assign_dish', {
            churchId: church?.id,
            dish_id: dishId,
            assignee,
          });
          await reload();
        } else {
          const dish = data.dishes.find((d) => d.id === dishId);
          if (
            data.attendance.some(
              (a) =>
                a.meeting_id === dish?.meeting_id &&
                a.user_id === assignee &&
                a.status === 'not-going',
            )
          )
            throw Error('This member is not attending.');
          persist({
            ...data,
            dishes: data.dishes.map((d) =>
              d.id === dishId ? { ...d, assignee_id: assignee } : d,
            ),
          });
        }
      },
      assignee ? 'Dish commitment saved.' : 'Dish is available again.',
    );
  }
  async function removeDietary(id: string) {
    return run(async () => {
      if (configured) {
        await communityRequest('remove_dietary', { churchId: church?.id, id });
        await reload();
      } else
        persist({
          ...data,
          dietary: data.dietary.filter(
            (d) => d.id !== id || d.user_id !== userId,
          ),
        });
    }, 'Food requirement removed.');
  }
  async function rpc(action: string, args: Record<string, unknown>) {
    let value: unknown;
    const ok = await run(async () => {
      if (!configured) {
        const next = structuredClone(data);
        if (action === 'set_church_access' && isAdmin) {
          const m = next.church_members.find(
            (m) => m.church_id === church?.id && m.user_id === args.user_id,
          );
          if (!m) throw Error('Member unavailable.');
          m.status = args.status as typeof m.status;
          m.modules = args.modules as typeof m.modules;
        } else if (action === 'set_group_access' && isLeader) {
          const m = next.members.find(
            (m) => m.group_id === group?.id && m.user_id === args.user_id,
          );
          if (!m || m.role === 'leader')
            throw Error('Select a member or guest.');
          m.capabilities = args.capabilities as typeof m.capabilities;
        } else if (action === 'update_directory' && isLeader) {
          const g = next.groups.find((g) => g.id === group?.id);
          if (g) g.discovery = args.profile as typeof g.discovery;
        } else if (action === 'request_church') {
          if (
            next.church_members.some(
              (m) => m.user_id === userId && m.church_id === args.churchId,
            )
          )
            throw Error('You already belong to this church.');
          next.church_members.push({
            church_id: String(args.churchId),
            user_id: userId,
            display_name: String(args.display_name),
            status: 'pending',
            modules: { ...defaultModules },
          });
        } else
          throw Error(
            'Connect the Appwrite community function to use this action.',
          );
        persist(next);
        value = true;
        return;
      }
      const result = await communityRequest(action, {
        churchId: church?.id,
        ...args,
      });
      value = result.value;
      await reload();
    });
    return ok ? value : undefined;
  }
  async function churchDirectory(
    search: string,
  ): Promise<{ id: string; name: string; city: string }[]> {
    if (!configured)
      return data.churches.filter((c) =>
        (c.name + ' ' + c.city).toLowerCase().includes(search.toLowerCase()),
      );
    const result = await communityRequest('church_directory', { search });
    return result.items;
  }
  async function signIn(email: string) {
    return run(async () => {
      if (!account) throw Error('Appwrite login is not configured.');
      const token = await account.createEmailToken({
        userId: ID.unique(),
        email,
        phrase: true,
      });
      setLoginToken(token.userId);
      setPhrase(token.phrase ?? '');
    }, 'Check your email for a sign-in code.');
  }
  async function verifyCode(secret: string) {
    return run(async () => {
      if (!account || !loginToken) throw Error('Request a sign-in code first.');
      await account.createSession({ userId: loginToken, secret });
      const u = await account.get();
      setSession({ user: { id: u.$id, email: u.email } });
      setLoginToken('');
      setPhrase('');
      window.location.assign('#onboarding');
    }, 'Signed in to Appwrite.');
  }
  async function signOut() {
    return run(async () => {
      if (account) await account.deleteSession({ sessionId: 'current' });
      request.current++;
      setRemote(emptyCommunity);
      setSession(null);
    }, 'Signed out.');
  }
  return {
    data,
    canModule,
    canGroup,
    needsChurch,
    directory,
    churchDirectory,
    church,
    groups,
    group,
    userId,
    isAdmin,
    isLeader,
    configured,
    authConfigured,
    session,
    authReady,
    busy,
    error,
    message,
    loginToken,
    phrase,
    setError,
    setMessage,
    setSelectedChurch,
    setSelectedGroup,
    save,
    rsvp,
    assignDish,
    removeDietary,
    rpc,
    signIn,
    verifyCode,
    signOut,
    reload,
    run,
    persist,
  };
}
const CommunityContext = createContext<ReturnType<
  typeof useCommunityState
> | null>(null);
export function CommunityProvider({ children }: { children: ReactNode }) {
  const value = useCommunityState();
  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
}
// oxlint-disable-next-line react/only-export-components -- Context and its typed hook intentionally share one module.
export function useCommunity() {
  const value = useContext(CommunityContext);
  if (!value) throw Error('CommunityProvider required');
  return value;
}
